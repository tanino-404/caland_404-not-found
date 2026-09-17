import { useMemo, useState } from 'react';
import { DayHud } from './components/hud/DayHud';
import { LoginScreen } from './components/hud/LoginScreen';
import { MonthHud } from './components/hud/MonthHud';
import { MonthScene } from './components/month/MonthScene';
import { YearHeatmap } from './components/year/YearHeatmap';
import { SAMPLE_YEAR } from './data/sampleEvents';
import { useSharedCalendar } from './hooks/useSharedCalendar';
import { busiestMonth, countEventsInMonth, groupEventsByDate, toDateKey } from './lib/calendar';
import { datesSharedBetween, eventsOwnedBy } from './lib/members';
import type { IslandLayout, ViewState } from './types/calendar';

export const App = () => {
  const calendar = useSharedCalendar();
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

  if (view.kind === 'year') {
    return (
      <YearHeatmap
        year={view.year}
        byDate={byDate}
        onSelectMonth={(month) => setView({ kind: 'month', year: view.year, month })}
      />
    );
  }

  const { year, month } = view;
  const shiftMonth = (delta: number) => {
    const next = ((month - 1 + delta + 12) % 12) + 1;
    setHoveredKey(null);
    setView({ kind: 'month', year, month: next });
  };

  return (
    <div className="app">
      <div className="scene">
        <MonthScene
          view={view}
          byDate={islands ? islands.mine : byDate}
          members={calendar.members}
          layout={islands ? 'split' : 'merged'}
          partner={islands ? islands.partner : null}
          hoveredKey={hoveredKey}
          onHover={setHoveredKey}
          onSelectDay={(day) => setView({ kind: 'day', year, month, day })}
        />
      </div>
      {user === null ? (
        <LoginScreen
          members={calendar.members}
          onLogin={calendar.login}
          onReset={calendar.resetToSample}
        />
      ) : view.kind === 'month' ? (
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
          onLogout={calendar.logout}
        />
      ) : (
        <DayHud
          year={year}
          month={month}
          day={view.day}
          events={byDate.get(toDateKey(year, month, view.day)) ?? []}
          members={calendar.members}
          currentUser={user}
          onBack={() => setView({ kind: 'month', year, month })}
          onAddEvent={(title, category, invited) =>
            calendar.addEvent({ date: toDateKey(year, month, view.day), title, category, invited })
          }
          onJoinEvent={calendar.joinEvent}
          onRemoveEvent={calendar.removeEvent}
        />
      )}
    </div>
  );
};
