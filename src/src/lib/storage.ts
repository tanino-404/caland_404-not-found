import type { CalendarEvent } from '../types/calendar';

/** スキーマを変えたら version を上げる。旧バージョンのデータは捨ててサンプルから作り直す。 */
const STORAGE_KEY = 'schedule-terrain-map';
const STORAGE_VERSION = 1;

export interface SharedCalendarState {
  version: number;
  members: string[];
  currentUser: string | null;
  events: CalendarEvent[];
}

export const loadState = (): SharedCalendarState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error(`storage: 保存データの形式が不正です: ${raw.slice(0, 80)}`);
  }
  if ((parsed as { version: unknown }).version !== STORAGE_VERSION) {
    return null;
  }
  return parsed as SharedCalendarState;
};

export const saveState = (state: SharedCalendarState): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: STORAGE_VERSION }));
};

export const clearState = (): void => {
  window.localStorage.removeItem(STORAGE_KEY);
};

export const initialState = (members: string[], events: CalendarEvent[]): SharedCalendarState => ({
  version: STORAGE_VERSION,
  members,
  currentUser: null,
  events,
});
