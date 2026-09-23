import { useMemo } from 'react';
import { MONTH_NAMES_EN, buildMonthGrid } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import { monthSeason } from '../../lib/season';
import { ELEVATION_COLORS, elevationColor } from '../models/blocks/blockKinds';
import './YearIslands.css';

export interface YearHeatmapProps {
  year: number;
  byDate: Map<string, CalendarEvent[]>;
  onSelectMonth: (month: number) => void;
}

interface IslandCell {
  /** その月の日。月外のマスは null（海） */
  day: number | null;
  count: number;
}

interface Island {
  month: number;
  nameEn: string;
  /** 7 列 × rows 行、row-major */
  cells: IslandCell[];
  rows: number;
  total: number;
  peak: number;
}

const SEA_CELL: IslandCell = { day: null, count: 0 };

const buildIsland = (
  year: number,
  month: number,
  byDate: Map<string, CalendarEvent[]>,
): Island => {
  const { cells: monthCells, rows } = buildMonthGrid(year, month);
  const cells: IslandCell[] = new Array<IslandCell>(rows * 7).fill(SEA_CELL);
  let total = 0;
  let peak = 0;
  for (const cell of monthCells) {
    const count = byDate.get(cell.dateKey)?.length ?? 0;
    total += count;
    if (count > peak) peak = count;
    cells[cell.row * 7 + cell.col] = { day: cell.day, count };
  }
  return { month, nameEn: MONTH_NAMES_EN[month - 1], cells, rows, total, peak };
};

const ELEVATION_LABELS = ['0', '1', '2', '3', '4', '5', '6+'];

export const YearHeatmap = ({ year, byDate, onSelectMonth }: YearHeatmapProps) => {
  const islands = useMemo(
    () => Array.from({ length: 12 }, (_, i) => buildIsland(year, i + 1, byDate)),
    [year, byDate],
  );

  return (
    <section className="yi">
      <header className="yi-head">
        <div className="yi-year">{year}</div>
        <div>
          <h1 className="yi-title">一年を、上から見る。</h1>
          <p className="yi-sub">
            12 の島。海は予定なし、雪山は 6 件以上。島をクリックで降りる。
          </p>
        </div>
      </header>

      <div className="yi-grid">
        {islands.map((island) => {
          const season = monthSeason(island.month);
          return (
          <button
            key={island.month}
            type="button"
            className={`yi-card yi-season-${season.effect}`}
            onClick={() => onSelectMonth(island.month)}
            aria-label={`${island.month}月の島 ${season.label} 予定 ${island.total} 件 最高峰 ${island.peak} 件`}
          >
            <div className="yi-card-head">
              <span className="yi-month">
                {island.month}
                <small>月</small>
              </span>
              <span className="yi-card-meta">
                <span className="yi-en">{island.nameEn}</span>
                <span className="yi-season-tag">{season.label}</span>
                <span className="yi-count">{island.total} 件</span>
                <span className="yi-peak">最高峰 {island.peak} 件</span>
              </span>
            </div>
            <div className="yi-map">
              <div className="yi-map-grid" aria-hidden="true">
                {island.cells.map((cell, i) =>
                  cell.day === null || cell.count === 0 ? (
                    <span key={i} className="yi-cell yi-cell-sea" />
                  ) : (
                    <span
                      key={i}
                      className="yi-cell"
                      style={{ background: elevationColor(cell.count) }}
                    />
                  ),
                )}
              </div>
            </div>
          </button>
          );
        })}
      </div>

      <footer className="yi-legend">
        <span>低</span>
        {ELEVATION_COLORS.map((color, i) => (
          <span key={color} className="yi-legend-step">
            <span className="yi-swatch" style={{ background: color }} />
            <small>{ELEVATION_LABELS[i]}</small>
          </span>
        ))}
        <span>高</span>
      </footer>
    </section>
  );
};
