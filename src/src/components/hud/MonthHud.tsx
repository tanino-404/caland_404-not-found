import { MONTH_NAMES_EN, formatDateJa } from '../../lib/calendar';
import { breakdownByOwner, memberColor, ownerChipBackground } from '../../lib/members';
import { CATEGORIES, CATEGORY_INFO, type CalendarEvent } from '../../types/calendar';

export interface MonthHudProps {
  year: number;
  month: number;
  monthTotal: number;
  hoveredKey: string | null;
  byDate: Map<string, CalendarEvent[]>;
  members: string[];
  currentUser: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onShowYear: () => void;
  onLogout: () => void;
}

const parseKey = (key: string): [number, number, number] => {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
};

const NO_EVENTS: CalendarEvent[] = [];

export const MonthHud = ({
  year,
  month,
  monthTotal,
  hoveredKey,
  byDate,
  members,
  currentUser,
  onPrevMonth,
  onNextMonth,
  onShowYear,
  onLogout,
}: MonthHudProps) => {
  const hovered = hoveredKey ? parseKey(hoveredKey) : null;
  const hoveredEvents = hoveredKey ? (byDate.get(hoveredKey) ?? NO_EVENTS) : NO_EVENTS;
  const breakdown = breakdownByOwner(hoveredEvents);
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  const allColors = members.map((m) => memberColor(members, m));

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
        <div className="hud-user panel">
          <span className="chip" style={{ background: memberColor(members, currentUser) }} />
          <span className="hud-user-name">{currentUser}</span>
          <button type="button" className="link-btn" onClick={onLogout}>
            ログアウト
          </button>
        </div>
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
        <ul className="hud-legend-members">
          {members.map((member) => (
            <li key={member}>
              <span className="chip" style={{ background: memberColor(members, member) }} />
              {member}
            </li>
          ))}
          {members.length >= 2 ? (
            <li>
              <span className="chip" style={{ background: ownerChipBackground(allColors) }} />
              みんなの予定
            </li>
          ) : null}
        </ul>
        <ul className="hud-legend-categories">
          {CATEGORIES.map((category) => (
            <li key={category}>
              <span className="chip" style={{ background: CATEGORY_INFO[category].color }} />
              {CATEGORY_INFO[category].label}
            </li>
          ))}
        </ul>
        <p className="hud-hint">
          ブロックの数 = 予定の数。ホバーで建物の足元に持ち主の色が出る。クリックで町へ降りる
        </p>
      </aside>

      {hovered ? (
        <div className="hud-tooltip panel" role="status">
          <span>
            {formatDateJa(hovered[0], hovered[1], hovered[2])} — 予定 {hoveredEvents.length} 件
          </span>
          {hoveredEvents.length > 0 ? (
            <span className="hud-tooltip-owners">
              {members.map((member) => {
                const count = breakdown.solo.get(member) ?? 0;
                return count > 0 ? (
                  <span key={member}>
                    <span className="chip" style={{ background: memberColor(members, member) }} />
                    {member} {count}
                  </span>
                ) : null;
              })}
              {breakdown.shared > 0 ? (
                <span>
                  <span className="chip" style={{ background: ownerChipBackground(allColors) }} />
                  みんな {breakdown.shared}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
