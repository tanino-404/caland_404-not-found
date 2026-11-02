import { type FormEvent, useState } from 'react';
import { formatDateJa, toDateKey } from '../../lib/calendar';
import { memberColor, ownerChipBackground, ownerColors } from '../../lib/members';
import {
  requestSuggestion,
  weatherLine,
  type SuggestRequest,
  type SuggestionResult,
} from '../../lib/suggestApi';
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
  onAddEvent: (
    title: string,
    category: EventCategory,
    invited: string[],
    place: string,
  ) => Promise<void>;
  onJoinEvent: (eventId: string) => Promise<void>;
  onRemoveEvent: (eventId: string) => Promise<void>;
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
  const [place, setPlace] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const trimmed = title.trim();
  const overflow = events.length - MAX_ROOFTOP_OBJECTS;
  const others = members.filter((m) => m !== currentUser);

  const toggleInvite = (name: string) =>
    setInvited((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const fail = (err: unknown) => {
    console.error(err);
    setError(err instanceof Error ? err.message : String(err));
  };

  const runSuggest = (request: SuggestRequest) => {
    setSuggesting(true);
    setSuggestion(null);
    requestSuggestion(request)
      .then((result) => {
        setSuggestion(result);
        setError(null);
      })
      .catch(fail)
      .finally(() => setSuggesting(false));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed.length === 0) return;
    const placeTrimmed = place.trim();
    void onAddEvent(trimmed, category, invited, placeTrimmed)
      .then(() => {
        setTitle('');
        setInvited([]);
        setPlace('');
        setError(null);
        if (placeTrimmed.length > 0) {
          runSuggest({
            date: toDateKey(year, month, day),
            title: trimmed,
            category,
            place: placeTrimmed,
          });
        }
      })
      .catch(fail);
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
          <p className="day-panel-empty">この日は予定なし。静かな海が広がっています。</p>
        ) : (
          <ol className="day-panel-list">
            {events.map((event) => {
              const mine = event.owners.includes(currentUser);
              const shared = event.owners.length >= 2;
              const eventPlace = event.place?.trim() ?? '';
              return (
                <li key={event.id} className="day-panel-event">
                  <div className="day-panel-event-row">
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
                        onClick={() => {
                          void onRemoveEvent(event.id).then(() => setError(null)).catch(fail);
                        }}
                      >
                        {shared ? '抜ける' : '削除'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => {
                          void onJoinEvent(event.id).then(() => setError(null)).catch(fail);
                        }}
                      >
                        参加する
                      </button>
                    )}
                  </div>
                  {eventPlace.length > 0 ? (
                    <div className="day-panel-event-place">
                      <span>場所：{eventPlace}</span>
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={suggesting}
                        onClick={() =>
                          runSuggest({
                            date: event.date,
                            title: event.title,
                            category: event.category,
                            place: eventPlace,
                          })
                        }
                      >
                        持ち物を提案
                      </button>
                    </div>
                  ) : null}
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

        {error !== null ? (
          <p className="ledger-status" role="alert">
            {error}
          </p>
        ) : null}

        {suggesting ? (
          <p className="suggest-status">場所と天気を調べて、持ち物を考えています…</p>
        ) : null}

        {suggestion !== null ? (
          <section className="suggest-box" aria-live="polite">
            <p className="suggest-kicker">{suggestion.placeName} の持ち物（LINE送信済み）</p>
            {suggestion.weather.length > 0 ? (
              <p className="suggest-weather">{weatherLine(suggestion.weather)}</p>
            ) : null}
            <ul className="suggest-items">
              {suggestion.items.map((item) => (
                <li key={`${item.name}-${item.reason}`}>
                  <span className="suggest-item-name">{item.name}</span>
                  <span className="suggest-item-reason">{item.reason}</span>
                </li>
              ))}
            </ul>
            <pre className="suggest-message">{suggestion.message}</pre>
          </section>
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
          <label className="day-panel-form-label" htmlFor="new-event-place">
            場所（入れると持ち物を提案して LINE に送る）
          </label>
          <input
            id="new-event-place"
            className="input"
            type="text"
            value={place}
            maxLength={40}
            placeholder="例：大阪城"
            autoComplete="off"
            onChange={(e) => setPlace(e.target.value)}
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
            <button type="submit" className="btn" disabled={trimmed.length === 0 || suggesting}>
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
