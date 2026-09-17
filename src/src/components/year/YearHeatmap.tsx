import { useMemo } from 'react';
import { WEEKDAY_LABELS_JA, formatDateJa, toDateKey } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import { ELEVATION_COLORS, elevationColor } from '../models/blocks/blockKinds';

export interface YearHeatmapProps {
  year: number;
  byDate: Map<string, CalendarEvent[]>;
  onSelectMonth: (month: number) => void;
}

interface HeatCell {
  key: string;
  month: number;
  day: number;
  count: number;
}

interface YearLayout {
  /** week-major。年の外側は null */
  cells: (HeatCell | null)[];
  weeks: number;
  /** month(1-12) → その月の 1 日がある週（0-based） */
  monthStartWeek: number[];
}

const DAY_MS = 86_400_000;

const buildYearLayout = (year: number, byDate: Map<string, CalendarEvent[]>): YearLayout => {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const start = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay());
  const end = new Date(dec31);
  end.setDate(dec31.getDate() + (6 - dec31.getDay()));
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const weeks = totalDays / 7;

  const cells: (HeatCell | null)[] = [];
  const monthStartWeek: number[] = new Array<number>(13).fill(0);
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (date.getFullYear() !== year) {
      cells.push(null);
      continue;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (day === 1) {
      monthStartWeek[month] = Math.floor(i / 7);
    }
    const key = toDateKey(year, month, day);
    cells.push({ key, month, day, count: byDate.get(key)?.length ?? 0 });
  }
  return { cells, weeks, monthStartWeek };
};

const ELEVATION_LABELS = ['0', '1', '2', '3', '4', '5', '6+'];

export const YearHeatmap = ({ year, byDate, onSelectMonth }: YearHeatmapProps) => {
  const layout = useMemo(() => buildYearLayout(year, byDate), [year, byDate]);
  const total = useMemo(() => {
    let n = 0;
    for (const list of byDate.values()) n += list.length;
    return n;
  }, [byDate]);

  const gridColumns = { gridTemplateColumns: `repeat(${layout.weeks}, var(--heat-cell))` };

  return (
    <section className="year">
      <header className="year-head">
        <div className="year-number">{year}</div>
        <div>
          <h1 className="year-title">一年を、上から見る。</h1>
          <p className="year-sub">
            色は標高。草原は予定なし、雪山は 6 件以上。全 {total} 件。月をクリックで降りる。
          </p>
        </div>
      </header>

      <div className="year-body">
        <div className="year-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS_JA.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="year-grid-wrap">
          <div className="year-months" style={gridColumns}>
            {layout.monthStartWeek.slice(1).map((week, i) => (
              <button
                key={i + 1}
                type="button"
                className="year-month-btn"
                style={{ gridColumn: `${week + 1} / span 4` }}
                onClick={() => onSelectMonth(i + 1)}
              >
                {i + 1}月
              </button>
            ))}
          </div>
          <div className="year-grid" style={gridColumns}>
            {layout.cells.map((cell, i) =>
              cell ? (
                <button
                  key={cell.key}
                  type="button"
                  className="heat-cell"
                  style={{ background: elevationColor(cell.count) }}
                  title={`${formatDateJa(year, cell.month, cell.day)} 予定 ${cell.count} 件`}
                  aria-label={`${cell.month}月${cell.day}日 予定 ${cell.count} 件`}
                  onClick={() => onSelectMonth(cell.month)}
                />
              ) : (
                <span key={`empty-${i}`} className="heat-cell heat-cell-empty" />
              ),
            )}
          </div>
        </div>
      </div>

      <footer className="year-legend">
        <span>低</span>
        {ELEVATION_COLORS.map((color, i) => (
          <span key={color} className="year-legend-step">
            <span className="heat-cell" style={{ background: color }} />
            <small>{ELEVATION_LABELS[i]}</small>
          </span>
        ))}
        <span>高</span>
      </footer>
    </section>
  );
};
