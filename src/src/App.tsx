import { useEffect, useMemo, useState } from 'react';
import { DayHud } from './components/hud/DayHud';
import { LoginScreen } from './components/hud/LoginScreen';
import { MonthHud } from './components/hud/MonthHud';
import { PluginHud } from './components/hud/PluginHud';
import { MonthScene } from './components/month/MonthScene';
import { YearHeatmap } from './components/year/YearHeatmap';
import { SAMPLE_YEAR } from './data/sampleEvents';
import { useSharedCalendar, type SharedCalendar } from './hooks/useSharedCalendar';
import { busiestMonth, countEventsInMonth, groupEventsByDate, toDateKey } from './lib/calendar';
import { islandThemeFor } from './lib/effects';
import { datesSharedBetween, eventsOwnedBy } from './lib/members';
import { effectById, monthEndKey, monthStartKey, statusAt } from './lib/pluginStatus';
import type { IslandLayout, ViewState } from './types/calendar';
import type { IslandTheme } from './types/island';
import type { PluginState, PluginStatus } from './types/plugins';

export const App = () => {
  const calendar = useSharedCalendar();
  if (calendar.loadError !== null) {
    return (
      <div className="app">
        <pre className="boot-panel panel" role="alert">
          {calendar.loadError}
        </pre>
      </div>
    );
  }
  if (!calendar.calendarReady || (calendar.plugin === null && calendar.pluginError === null)) {
    return (
      <div className="app">
        <p className="boot-panel panel">地図を読み込んでいます</p>
      </div>
    );
  }
  return <MapScreen calendar={calendar} plugin={calendar.plugin} />;
};

/** plugin が null のとき（読み込みに失敗）は、地図だけ出して管理の表示はエラーにする */
const MapScreen = ({ calendar, plugin }: { calendar: SharedCalendar; plugin: PluginState | null }) => {
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
  const [pluginOpen, setPluginOpen] = useState(false);

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

  /** 各月の目標と進捗。基準日はその月の最終日（期間中か、直前に終わった目標を見せる） */
  const monthStatuses = useMemo(() => {
    const map = new Map<number, PluginStatus>();
    if (plugin === null) return map;
    for (let month = 1; month <= 12; month++) {
      map.set(month, statusAt(plugin.manifest, plugin.goals, plugin.entries, monthEndKey(view.year, month)));
    }
    return map;
  }, [plugin, view.year]);

  const statusOf = (month: number): PluginStatus => {
    if (plugin === null) {
      throw new Error('App: プラグインが読み込まれていません');
    }
    const status = monthStatuses.get(month);
    if (status === undefined) {
      throw new Error(`App: 月の状態がありません: ${month}`);
    }
    return status;
  };

  const effect =
    view.kind === 'year' || plugin === null ? null : effectById(plugin.manifest, statusOf(view.month).effect);
  const theme: IslandTheme = effect === null ? 'plain' : islandThemeFor(effect.theme);

  /** 年ビュー：表示中プラグインのエフェクトが黄金郷の土台になる月 */
  const luxuriousMonths = useMemo(() => {
    const luxurious = new Set<number>();
    if (plugin === null) return luxurious;
    for (const [month, status] of monthStatuses) {
      if (islandThemeFor(effectById(plugin.manifest, status.effect).theme) === 'luxury') luxurious.add(month);
    }
    return luxurious;
  }, [monthStatuses, plugin]);

  const monthEntries = useMemo(() => {
    if (view.kind === 'year' || plugin === null) return [];
    const prefix = monthStartKey(view.year, view.month).slice(0, 8);
    return plugin.entries
      .filter((entry) => entry.date.startsWith(prefix))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [plugin, view]);

  const monthGoals = useMemo(() => {
    if (view.kind === 'year' || plugin === null) return [];
    const start = monthStartKey(view.year, view.month);
    const end = monthEndKey(view.year, view.month);
    return plugin.goals.filter((goal) => goal.start <= end && goal.end >= start);
  }, [plugin, view]);

  useEffect(() => {
    document.body.classList.toggle('is-luxury', theme === 'luxury');
    document.body.classList.toggle('is-muscle', theme === 'muscle');
    document.body.classList.toggle('is-library', theme === 'library');
    return () => document.body.classList.remove('is-luxury', 'is-muscle', 'is-library');
  }, [theme]);

  if (view.kind === 'year') {
    return (
      <YearHeatmap
        year={view.year}
        byDate={byDate}
        luxuriousMonths={luxuriousMonths}
        onSelectMonth={(month) => setView({ kind: 'month', year: view.year, month })}
      />
    );
  }

  const { year, month } = view;
  const shiftMonth = (delta: number) => {
    const next = ((month - 1 + delta + 12) % 12) + 1;
    setHoveredKey(null);
    setPluginOpen(false);
    setView({ kind: 'month', year, month: next });
  };

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
            setPluginOpen(false);
            setView({ kind: 'day', year, month, day });
          }}
          theme={theme}
          scene={effect?.scene ?? null}
          sceneKey={`${calendar.selectedPluginId}-${effect?.id ?? 'none'}`}
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
            onShowYear={() => setView({ kind: 'year', year })}
            onLogout={() => {
              setPluginOpen(false);
              calendar.logout();
            }}
            plugin={plugin === null ? null : { manifest: plugin.manifest, status: statusOf(month) }}
            pluginError={calendar.pluginError}
            selectedPluginId={calendar.selectedPluginId}
            plugins={calendar.plugins}
            onSelectPlugin={(id) => {
              setPluginOpen(false);
              return calendar.selectPlugin(id);
            }}
            onOpenPlugin={() => setPluginOpen(true)}
          />
          {pluginOpen && plugin === null ? (
            <div className="hud">
              <aside className="ledger-panel panel" aria-label="管理プラグインのエラー">
                <header className="ledger-head">
                  <h2 className="ledger-title">管理プラグインを読み込めません</h2>
                  <button type="button" className="link-btn" onClick={() => setPluginOpen(false)}>
                    閉じる
                  </button>
                </header>
                <pre className="ledger-status" role="alert">
                  {calendar.pluginError}
                </pre>
              </aside>
            </div>
          ) : null}
          {pluginOpen && plugin !== null ? (
            <div className="hud">
              <PluginHud
                key={`${plugin.manifest.id}-${year}-${month}`}
                manifest={plugin.manifest}
                group={plugin.group}
                onJoinGroup={calendar.joinPluginGroup}
                year={year}
                month={month}
                currentUser={user}
                entries={monthEntries}
                goals={monthGoals}
                status={statusOf(month)}
                onAddEntry={(date, data) => calendar.addPluginEntry({ date, data })}
                onRemoveEntry={calendar.removePluginEntry}
                onAddGoal={calendar.addPluginGoal}
                onRemoveGoal={calendar.removePluginGoal}
                onClose={() => setPluginOpen(false)}
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
