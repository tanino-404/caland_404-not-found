import { formatDateJa } from '../../lib/calendar';
import { CATEGORY_INFO, type CalendarEvent } from '../../types/calendar';
import { MAX_ROOFTOP_OBJECTS } from '../month/DayTower';

export interface DayHudProps {
  year: number;
  month: number;
  day: number;
  events: CalendarEvent[];
  onBack: () => void;
}

export const DayHud = ({ year, month, day, events, onBack }: DayHudProps) => {
  const overflow = events.length - MAX_ROOFTOP_OBJECTS;
  return (
    <div className="hud">
      <aside className="day-panel panel">
        <div className="day-panel-head">
          <div className="day-panel-number">{day}</div>
          <div>
            <div className="day-panel-date">{formatDateJa(year, month, day)}</div>
            <div className="day-panel-count">{events.length} 件の予定</div>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="day-panel-empty">この日は予定なし。静かな海が広がっています。</p>
        ) : (
          <ol className="day-panel-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className="chip" style={{ background: CATEGORY_INFO[event.category].color }} />
                <span className="day-panel-category">{CATEGORY_INFO[event.category].label}</span>
                <span>{event.title}</span>
              </li>
            ))}
          </ol>
        )}
        {overflow > 0 ? (
          <p className="day-panel-overflow">屋上に建てられるのは {MAX_ROOFTOP_OBJECTS} 軒まで。あと {overflow} 件は地下に。</p>
        ) : null}
        <button type="button" className="btn" onClick={onBack}>
          ◀ 月に戻る
        </button>
      </aside>
    </div>
  );
};
