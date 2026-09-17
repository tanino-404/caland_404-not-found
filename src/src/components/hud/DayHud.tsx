import { type FormEvent, useState } from 'react';
import { formatDateJa } from '../../lib/calendar';
import { memberColor, ownerChipBackground, ownerColors } from '../../lib/members';
import { CATEGORIES, CATEGORY_INFO, type CalendarEvent, type EventCategory } from '../../types/calendar';
import { MAX_ROOFTOP_OBJECTS } from '../month/DayTower';

export interface DayHudProps {
  year: number;
  month: number;
  day: number;
  events: CalendarEvent[];
  members: string[];
  currentUser: string;
  onBack: () => void;
  onAddEvent: (title: string, category: EventCategory, invited: string[]) => void;
  onJoinEvent: (eventId: string) => void;
  onRemoveEvent: (eventId: string) => void;
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
  onRemoveEvent,
}: DayHudProps) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('restaurant');
  const [invited, setInvited] = useState<string[]>([]);
  const trimmed = title.trim();
  const overflow = events.length - MAX_ROOFTOP_OBJECTS;
  const others = members.filter((m) => m !== currentUser);

  const toggleInvite = (name: string) =>
    setInvited((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed.length === 0) return;
    onAddEvent(trimmed, category, invited);
    setTitle('');
    setInvited([]);
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
              const shared = event.owners.length >= 2;
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
                  {mine ? (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      title={shared ? 'この予定から自分だけ抜ける' : 'この予定を消す'}
                      onClick={() => onRemoveEvent(event.id)}
                    >
                      {shared ? '抜ける' : '削除'}
                    </button>
                  ) : (
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
          <input
            id="new-event-title"
            className="input"
            type="text"
            value={title}
            maxLength={20}
            placeholder="予定名（例：ランチ会）"
            autoComplete="off"
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="category-picker" role="radiogroup" aria-label="建物の種類">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === category}
                className={c === category ? 'category-btn is-selected' : 'category-btn'}
                onClick={() => setCategory(c)}
              >
                <span className="chip" style={{ background: CATEGORY_INFO[c].color }} />
                {CATEGORY_INFO[c].label}
              </button>
            ))}
          </div>
          {others.length > 0 ? (
            <div className="invite-row">
              <span className="invite-label">誘う：</span>
              {others.map((name) => (
                <label key={name} className="invite-option">
                  <input
                    type="checkbox"
                    checked={invited.includes(name)}
                    onChange={() => toggleInvite(name)}
                  />
                  <span className="chip" style={{ background: memberColor(members, name) }} />
                  {name}
                </label>
              ))}
            </div>
          ) : null}
          <div className="day-panel-form-row">
            <button type="submit" className="btn" disabled={trimmed.length === 0}>
              {invited.length > 0 ? `${[currentUser, ...invited].join('・')} の予定を建てる` : '建てる'}
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
