import { MONTH_NAMES_EN, formatDateJa } from '../../lib/calendar';
import { CATEGORIES, CATEGORY_INFO, type CalendarEvent } from '../../types/calendar';

export interface MonthHudProps {
  year: number;
  month: number;
  monthTotal: number;
  hoveredKey: string | null;
  byDate: Map<string, CalendarEvent[]>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onShowYear: () => void;
}

const parseKey = (key: string): [number, number, number] => {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
};

export const MonthHud = ({
  year,
  month,
  monthTotal,
  hoveredKey,
  byDate,
  onPrevMonth,
  onNextMonth,
  onShowYear,
}: MonthHudProps) => {
  const hovered = hoveredKey ? parseKey(hoveredKey) : null;
  const hoveredCount = hoveredKey ? (byDate.get(hoveredKey)?.length ?? 0) : 0;
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;

  return (
    <div className="hud">
      <header className="hud-title">
        <div className="hud-month-number">{month}</div>
        <div className="hud-month-meta">
          <div className="hud-month-en">{MONTH_NAMES_EN[month - 1]}</div>
          <div className="hud-month-ja">
            {year}年{month}月 · 予定 {monthTotal} 件
          </div>
        </div>
      </header>

      <nav className="hud-nav" aria-label="表示切り替え">
        <button type="button" className="btn" onClick={onShowYear}>
          一年を見る
        </button>
      </nav>

      <nav className="hud-months" aria-label="月の移動">
        <button type="button" className="btn" onClick={onPrevMonth}>
          ◀ {prev}月
        </button>
        <button type="button" className="btn" onClick={onNextMonth}>
          {next}月 ▶
        </button>
      </nav>

      <aside className="hud-legend panel">
        <ul>
          {CATEGORIES.map((category) => (
            <li key={category}>
              <span className="chip" style={{ background: CATEGORY_INFO[category].color }} />
              {CATEGORY_INFO[category].label}
            </li>
          ))}
        </ul>
        <p className="hud-hint">ブロックの数 = 予定の数。日をクリックで町へ降りる</p>
      </aside>

      {hovered ? (
        <div className="hud-tooltip panel" role="status">
          {formatDateJa(hovered[0], hovered[1], hovered[2])} — 予定 {hoveredCount} 件
        </div>
      ) : null}
    </div>
  );
};
