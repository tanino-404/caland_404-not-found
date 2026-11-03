import { useEffect, useMemo, useState } from 'react';
import { DayHud } from './components/hud/DayHud';
import { LoginScreen } from './components/hud/LoginScreen';
import { MonthHud, type MonthPluginSummary } from './components/hud/MonthHud';
import { PluginHud } from './components/hud/PluginHud';
import { MonthScene } from './components/month/MonthScene';
import { YearHeatmap } from './components/year/YearHeatmap';
import { SAMPLE_YEAR } from './data/sampleEvents';
import { useSharedCalendar, type SharedCalendar } from './hooks/useSharedCalendar';
import { busiestMonth, countEventsInMonth, groupEventsByDate, toDateKey } from './lib/calendar';
import { datesSharedBetween, eventsOwnedBy } from './lib/members';
import {
  formatProgressValue,
  isAchieved,
  periodGoal,
  periodProgress,
  toYearMonth,
} from './lib/plugins';
import { ISLAND_EFFECTS } from './plugins/effects';
import type { IslandLayout, ViewState } from './types/calendar';
import type { IslandTheme } from './types/ledger';
import type { PluginData } from './types/plugins';

export const App = () => {
  const calendar = useSharedCalendar();
  if (calendar.calendarError !== null) {
    return (
      <div className="app">
        <pre className="boot-panel panel" role="alert">
          {calendar.calendarError}
        </pre>
      </div>
    );
  }
  if (!calendar.calendarReady || (!calendar.pluginsReady && calendar.pluginsError === null)) {
    return (
      <div className="app">
        <p className="boot-panel panel">地図を読み込んでいます</p>
      </div>
    );
  }
  return <MapScreen calendar={calendar} />;
};

/** 管理プラグイン 1 つぶんの、表示中の月の状態 */
interface MonthPluginState {
  data: PluginData;
  progress: number;
  goal: number | null;
  achieved: boolean;
}

const MapScreen = ({ calendar }: { calendar: SharedCalendar }) => {
  const byDate = useMemo(() => groupEventsByDate(calendar.events), [calendar.events]);
  const [view, setView] = useState<ViewState>(() => ({
    kind: 'month',
    year: SAMPLE_YEAR,
    month: busiestMonth(byDate, SAMPLE_YEAR),
  }));
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [layout, setLayout] = useState<IslandLayout>('merged');
  /** ふたりの島モードで奥に置くメンバー。未選択なら自分以外の先頭 */
  const [partnerChoice, setPartnerChoice] = useState<string | null>(null);
  /** 開いている管理プラグインの id。閉じているときは null */
  const [openPluginId, setOpenPluginId] = useState<string | null>(null);

  const user = calendar.currentUser;
  const partner = useMemo(() => {
    const others = calendar.members.filter((m) => m !== user);
    if (others.length === 0) return null;
    return partnerChoice !== null && others.includes(partnerChoice) ? partnerChoice : others[0];
  }, [calendar.members, user, partnerChoice]);

  /** split のとき手前の島（自分）と奥の島（相方）に分けた予定 */
  const islands = useMemo(() => {
    if (layout !== 'split' || user === null || partner === null) return null;
    return {
      mine: groupEventsByDate(eventsOwnedBy(calendar.events, user)),
      partner: {
        name: partner,
        byDate: groupEventsByDate(eventsOwnedBy(calendar.events, partner)),
        commonDates: datesSharedBetween(calendar.events, user, partner),
      },
    };
  }, [layout, user, partner, calendar.events]);

  const monthTotal = useMemo(
    () => (view.kind === 'year' ? 0 : countEventsInMonth(byDate, view.year, view.month)),
    [view, byDate],
  );

  /** 表示中の月の、全プラグインの進捗と達成（並びはサーバーの順） */
  const pluginStates: MonthPluginState[] = useMemo(() => {
    if (view.kind === 'year') return [];
    const monthKey = toYearMonth(view.year, view.month);
    return calendar.plugins.map((data) => {
      const progress = periodProgress(data.manifest, data.entries, monthKey);
      const goal = periodGoal(data.manifest, data.goals, monthKey);
      return { data, progress, goal, achieved: isAchieved(data.manifest, progress, goal) };
    });
  }, [calendar.plugins, view]);

  const opened = useMemo(
    () => pluginStates.find((state) => state.data.manifest.id === openPluginId) ?? null,
    [pluginStates, openPluginId],
  );

  /**
   * 達成した月の島の見た目。
   * パネルを開いているプラグインが達成していればその effect。
   * 開いていなければ、一覧の並び順で最初に達成しているプラグインの effect。
   */
  const effect = useMemo(() => {
    const candidates = opened !== null ? [opened, ...pluginStates] : pluginStates;
    for (const state of candidates) {
      if (!state.achieved) continue;
      const found = ISLAND_EFFECTS[state.data.manifest.effect];
      if (found !== undefined) return found;
    }
    return null;
  }, [opened, pluginStates]);
  const theme: IslandTheme = effect === null ? 'plain' : effect.theme;
  const EffectScene = effect?.Scene ?? null;

  const effectMismatch =
    opened !== null && ISLAND_EFFECTS[opened.data.manifest.effect] === undefined
      ? `effect "${opened.data.manifest.effect}" が src/src/plugins/effects/index.ts の部品表にありません`
      : null;

  /** 目標を達成したプラグインが 1 つ以上ある月（年ビューの金枠） */
  const achievedMonths = useMemo(() => {
    const set = new Set<number>();
    for (let month = 1; month <= 12; month++) {
      const monthKey = toYearMonth(view.year, month);
      for (const data of calendar.plugins) {
        const progress = periodProgress(data.manifest, data.entries, monthKey);
        if (isAchieved(data.manifest, progress, periodGoal(data.manifest, data.goals, monthKey))) {
          set.add(month);
          break;
        }
      }
    }
    return set;
  }, [calendar.plugins, view.year]);

  useEffect(() => {
    document.body.classList.toggle('is-luxury', theme === 'luxury');
    return () => document.body.classList.remove('is-luxury');
  }, [theme]);

  if (view.kind === 'year') {
    return (
      <YearHeatmap
        year={view.year}
        byDate={byDate}
        achievedMonths={achievedMonths}
        onSelectMonth={(month) => setView({ kind: 'month', year: view.year, month })}
      />
    );
  }

  const { year, month } = view;
  const shiftMonth = (delta: number) => {
    const next = ((month - 1 + delta + 12) % 12) + 1;
    setHoveredKey(null);
    setOpenPluginId(null);
    setView({ kind: 'month', year, month: next });
  };

  const hudPlugins: MonthPluginSummary[] = pluginStates.map(({ data, progress, goal, achieved }) => ({
    id: data.manifest.id,
    title: data.manifest.title,
    summary:
      goal === null
        ? `${data.manifest.progress.label} ${formatProgressValue(data.manifest, progress)} / 目標なし`
        : `${data.manifest.progress.label} ${formatProgressValue(data.manifest, progress)} / ${formatProgressValue(data.manifest, goal)}`,
    achieved,
    achievedLabel: data.manifest.achievedLabel,
  }));

  return (
    <div className={theme === 'luxury' ? 'app is-luxury' : 'app'}>
      <div className="scene">
        <MonthScene
          view={view}
          byDate={islands ? islands.mine : byDate}
          members={calendar.members}
          layout={islands ? 'split' : 'merged'}
          partner={islands ? islands.partner : null}
          hoveredKey={hoveredKey}
          onHover={setHoveredKey}
          onSelectDay={(day) => {
            setOpenPluginId(null);
            setView({ kind: 'day', year, month, day });
          }}
          theme={theme}
          EffectScene={EffectScene}
        />
      </div>
      {user === null ? (
        <LoginScreen
          members={calendar.members}
          onLogin={calendar.login}
          onReset={calendar.resetToSample}
        />
      ) : view.kind === 'month' ? (
        <>
          <MonthHud
            year={year}
            month={month}
            monthTotal={monthTotal}
            hoveredKey={hoveredKey}
            byDate={byDate}
            members={calendar.members}
            currentUser={user}
            layout={layout}
            partner={partner}
            onToggleLayout={() => setLayout((l) => (l === 'merged' ? 'split' : 'merged'))}
            onSelectPartner={setPartnerChoice}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            onShowYear={() => {
              setOpenPluginId(null);
              setView({ kind: 'year', year });
            }}
            onLogout={() => {
              setOpenPluginId(null);
              calendar.logout();
            }}
            plugins={hudPlugins}
            onOpenPlugin={setOpenPluginId}
          />
          {calendar.pluginsError !== null && opened === null ? (
            <div className="hud">
              <pre className="boot-panel panel" role="alert">
                {calendar.pluginsError}
              </pre>
            </div>
          ) : null}
          {opened !== null ? (
            <div className="hud">
              <PluginHud
                year={year}
                month={month}
                currentUser={user}
                data={opened.data}
                progress={opened.progress}
                goal={opened.goal}
                achieved={opened.achieved}
                effectMismatch={effectMismatch}
                loadError={calendar.pluginsError}
                onAdd={(date, values) =>
                  calendar.addPluginEntry(opened.data.manifest.id, { date, values })
                }
                onRemove={(entryId) => calendar.removePluginEntry(opened.data.manifest.id, entryId)}
                onSetGoal={
                  opened.data.manifest.progress.goal === 'per_period'
                    ? (amount) => calendar.setPluginGoal(opened.data.manifest.id, year, month, amount)
                    : null
                }
                onClose={() => setOpenPluginId(null)}
              />
            </div>
          ) : null}
        </>
      ) : (
        <DayHud
          year={year}
          month={month}
          day={view.day}
          events={byDate.get(toDateKey(year, month, view.day)) ?? []}
          members={calendar.members}
          currentUser={user}
          onBack={() => setView({ kind: 'month', year, month })}
          onAddEvent={(title, category, invited, place) =>
            calendar.addEvent({ date: toDateKey(year, month, view.day), title, category, invited, place })
          }
          onJoinEvent={calendar.joinEvent}
          onRemoveEvent={calendar.removeEvent}
        />
      )}
    </div>
  );
};
