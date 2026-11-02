import { useEffect, useMemo, useState } from 'react';
import { DayHud } from './components/hud/DayHud';
import { LedgerHud } from './components/hud/LedgerHud';
import { LoginScreen } from './components/hud/LoginScreen';
import { MonthHud } from './components/hud/MonthHud';
import { MonthScene } from './components/month/MonthScene';
import { YearHeatmap } from './components/year/YearHeatmap';
import { SAMPLE_YEAR } from './data/sampleEvents';
import { useSharedCalendar, type SharedCalendar } from './hooks/useSharedCalendar';
import { busiestMonth, countEventsInMonth, groupEventsByDate, toDateKey } from './lib/calendar';
import { isMonthLuxurious, monthGoal, monthLedger } from './lib/ledger';
import { datesSharedBetween, eventsOwnedBy } from './lib/members';
import type { IslandLayout, ViewState } from './types/calendar';
import type { IslandTheme } from './types/ledger';

export const App = () => {
  const calendar = useSharedCalendar();
  if (calendar.ledgerError !== null) {
    return (
      <div className="app">
        <pre className="boot-panel panel" role="alert">
          {calendar.ledgerError}
        </pre>
      </div>
    );
  }
  if (!calendar.ledgerReady || !calendar.calendarReady) {
    return (
      <div className="app">
        <p className="boot-panel panel">地図を読み込んでいます</p>
      </div>
    );
  }
  return <MapScreen calendar={calendar} />;
};

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
  const [ledgerOpen, setLedgerOpen] = useState(false);

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

  const ledgerMonth = useMemo(() => {
    if (view.kind === 'year') return null;
    return monthLedger(calendar.ledger, view.year, view.month);
  }, [calendar.ledger, view]);
  const goal = view.kind === 'year' ? null : monthGoal(calendar.goals, view.year, view.month);
  const achieved = ledgerMonth !== null && isMonthLuxurious(ledgerMonth.savings, goal);
  const theme: IslandTheme = achieved ? 'luxury' : 'plain';

  const luxuriousMonths = useMemo(() => {
    const set = new Set<number>();
    for (let month = 1; month <= 12; month++) {
      const summary = monthLedger(calendar.ledger, view.year, month);
      if (isMonthLuxurious(summary.savings, monthGoal(calendar.goals, view.year, month))) {
        set.add(month);
      }
    }
    return set;
  }, [calendar.ledger, calendar.goals, view.year]);

  useEffect(() => {
    document.body.classList.toggle('is-luxury', theme === 'luxury');
    return () => document.body.classList.remove('is-luxury');
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
    setLedgerOpen(false);
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
            setLedgerOpen(false);
            setView({ kind: 'day', year, month, day });
          }}
          theme={theme}
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
              setLedgerOpen(false);
              calendar.logout();
            }}
            savings={ledgerMonth?.savings ?? 0}
            goal={goal}
            achieved={achieved}
            onOpenLedger={() => setLedgerOpen(true)}
          />
          {ledgerOpen && ledgerMonth !== null ? (
            <div className="hud">
              <LedgerHud
                year={year}
                month={month}
                currentUser={user}
                ledger={ledgerMonth}
                goal={goal}
                achieved={achieved}
                onAdd={(day, kind, amount, title) =>
                  calendar.addLedgerEntry({
                    date: toDateKey(year, month, day),
                    kind,
                    amount,
                    title,
                  })
                }
                onRemove={calendar.removeLedgerEntry}
                onSetGoal={(amount) => calendar.setMonthlyGoal(year, month, amount)}
                onClose={() => setLedgerOpen(false)}
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
