import { type FormEvent, useState } from 'react';
import { formatDateJa } from '../../lib/calendar';
import { ownerChipBackground, ownerColors } from '../../lib/members';
import { CATEGORIES, CATEGORY_INFO, type CalendarEvent, type EventCategory } from '../../types/calendar';
import { MAX_ROOFTOP_OBJECTS } from '../month/DayTower';

const isEventCategory = (value: string): value is EventCategory =>
  (CATEGORIES as string[]).includes(value);

const toCategory = (value: string): EventCategory => {
  if (!isEventCategory(value)) {
    throw new Error(`DayHud: 未知のカテゴリ "${value}"`);
  }
  return value;
};

export interface DayHudProps {
  year: number;
  month: number;
  day: number;
  events: CalendarEvent[];
  members: string[];
  currentUser: string;
  onBack: () => void;
  onAddEvent: (title: string, category: EventCategory) => void;
  onJoinEvent: (eventId: string) => void;
}

export const DayHud = ({
  year,
  month,
  day,
  events,
  members,
  currentUser,
  onBack,
  onAddEvent,
  onJoinEvent,
}: DayHudProps) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('restaurant');
  const trimmed = title.trim();
  const overflow = events.length - MAX_ROOFTOP_OBJECTS;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed.length === 0) return;
    onAddEvent(trimmed, category);
    setTitle('');
  };

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
          <p className="day-panel-empty">この日は予定なし。草原が広がっています。</p>
        ) : (
          <ol className="day-panel-list">
            {events.map((event) => {
              const mine = event.owners.includes(currentUser);
              return (
                <li key={event.id}>
                  <span
                    className="chip chip-owner"
                    title={event.owners.join('・')}
                    style={{ background: ownerChipBackground(ownerColors(members, event.owners)) }}
                  />
                  <span className="chip" style={{ background: CATEGORY_INFO[event.category].color }} />
                  <span className="day-panel-category">{CATEGORY_INFO[event.category].label}</span>
                  <span className="day-panel-title">{event.title}</span>
                  <span className="day-panel-owners">{event.owners.join('・')}</span>
                  {mine ? null : (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => onJoinEvent(event.id)}
                    >
                      参加する
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {overflow > 0 ? (
          <p className="day-panel-overflow">
            屋上に建てられるのは {MAX_ROOFTOP_OBJECTS} 軒まで。あと {overflow} 件は地下に。
          </p>
        ) : null}

        <form className="day-panel-form" onSubmit={submit}>
          <label className="day-panel-form-label" htmlFor="new-event-title">
            {currentUser} の予定を建てる
          </label>
          <div className="day-panel-form-row">
            <input
              id="new-event-title"
              className="input"
              type="text"
              value={title}
              maxLength={20}
              placeholder="例：ランチ会"
              autoComplete="off"
              onChange={(e) => setTitle(e.target.value)}
            />
            <select
              className="input"
              aria-label="種類"
              value={category}
              onChange={(e) => setCategory(toCategory(e.target.value))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_INFO[c].label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn" disabled={trimmed.length === 0}>
              建てる
            </button>
          </div>
        </form>

        <button type="button" className="btn" onClick={onBack}>
          ◀ 月に戻る
        </button>
      </aside>
    </div>
  );
};
