import { MONTH_NAMES_EN, countEventsInMonth, formatDateJa } from '../../lib/calendar';
import { memberColor } from '../../lib/members';
import { CATEGORIES, CATEGORY_INFO, type CalendarEvent } from '../../types/calendar';
import './FriendHud.css';

export interface FriendHudProps {
  year: number;
  month: number;
  /** 今見ている友達 */
  friend: string;
  /** 色用（memberColor(members, name)） */
  members: string[];
  /** 友達が所有者の予定（件数の表示用） */
  byDate: Map<string, CalendarEvent[]>;
  /** 自分と友達の両方が所有者の予定（飛行機クリック時の件数用） */
  sharedByDate: Map<string, CalendarEvent[]>;
  /** 塔のホバー */
  hoveredKey: string | null;
  /** 飛行機をクリックして選んでいる日付。null なら未選択 */
  selectedFlightKey: string | null;
  onCloseFlight: () => void;
}

const parseKey = (key: string): [number, number, number] => {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
};

const dateLabel = (key: string): string => {
  const [y, m, d] = parseKey(key);
  return formatDateJa(y, m, d);
};

/**
 * 友達の島の HUD。見るだけのモードなので、出すのは日付と件数だけ
 * （持ち主の内訳や予定名は出さない）。表示の切り替えは画面下部の BottomBar が持つ
 */
export const FriendHud = ({
  year,
  month,
  friend,
  members,
  byDate,
  sharedByDate,
  hoveredKey,
  selectedFlightKey,
  onCloseFlight,
}: FriendHudProps) => {
  const monthTotal = countEventsInMonth(byDate, year, month);
  const hoveredCount = hoveredKey ? (byDate.get(hoveredKey)?.length ?? 0) : 0;
  const sharedCount = selectedFlightKey ? (sharedByDate.get(selectedFlightKey)?.length ?? 0) : 0;

  return (
    <div className="hud">
      <header className="hud-title">
        <div className="hud-month-number">{month}</div>
        <div className="hud-month-meta">
          <div className="hud-month-en">{MONTH_NAMES_EN[month - 1]}</div>
          <div className="hud-month-ja">
            {year}年{month}月 · {friend} の島 · 予定 {monthTotal} 件
          </div>
        </div>
      </header>

      <nav className="hud-nav" aria-label="今いる島">
        <div className="hud-user panel">
          <span className="chip" style={{ background: memberColor(members, friend) }} />
          <span className="hud-user-name">{friend} の島</span>
        </div>
      </nav>


      <aside className="hud-legend panel">
        <ul className="hud-legend-categories">
          {CATEGORIES.map((category) => (
            <li key={category}>
              <span className="chip" style={{ background: CATEGORY_INFO[category].color }} />
              {CATEGORY_INFO[category].label}
            </li>
          ))}
        </ul>
        <p className="hud-hint">
          {friend} の島。飛行機はふたりの予定の日。クリックで件数が出る
        </p>
      </aside>

      {selectedFlightKey !== null ? (
        <div className="hud-tooltip friend-tooltip panel" role="status">
          <span>
            {dateLabel(selectedFlightKey)} — ふたりの予定 {sharedCount} 件
          </span>
          <button type="button" className="link-btn" onClick={onCloseFlight}>
            閉じる
          </button>
        </div>
      ) : hoveredKey !== null ? (
        <div className="hud-tooltip friend-tooltip panel" role="status">
          <span>
            {dateLabel(hoveredKey)} — 予定 {hoveredCount} 件
          </span>
        </div>
      ) : null}
    </div>
  );
};
