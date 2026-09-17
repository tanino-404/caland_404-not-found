import { useMemo, useState } from 'react';
import { DayHud } from './components/hud/DayHud';
import { MonthHud } from './components/hud/MonthHud';
import { MonthScene } from './components/month/MonthScene';
import { YearHeatmap } from './components/year/YearHeatmap';
import { SAMPLE_YEAR, sampleEvents } from './data/sampleEvents';
import { busiestMonth, countEventsInMonth, groupEventsByDate, toDateKey } from './lib/calendar';
import type { ViewState } from './types/calendar';

const BY_DATE = groupEventsByDate(sampleEvents);
const INITIAL_VIEW: ViewState = {
  kind: 'month',
  year: SAMPLE_YEAR,
  month: busiestMonth(BY_DATE, SAMPLE_YEAR),
};

export const App = () => {
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const monthTotal = useMemo(
    () => (view.kind === 'year' ? 0 : countEventsInMonth(BY_DATE, view.year, view.month)),
    [view],
  );

  if (view.kind === 'year') {
    return (
      <YearHeatmap
        year={view.year}
        byDate={BY_DATE}
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
          byDate={BY_DATE}
          hoveredKey={hoveredKey}
          onHover={setHoveredKey}
          onSelectDay={(day) => setView({ kind: 'day', year, month, day })}
        />
      </div>
      {view.kind === 'month' ? (
        <MonthHud
          year={year}
          month={month}
          monthTotal={monthTotal}
          hoveredKey={hoveredKey}
          byDate={BY_DATE}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          onShowYear={() => setView({ kind: 'year', year })}
        />
      ) : (
        <DayHud
          year={year}
          month={month}
          day={view.day}
          events={BY_DATE.get(toDateKey(year, month, view.day)) ?? []}
          onBack={() => setView({ kind: 'month', year, month })}
        />
      )}
    </div>
  );
};
