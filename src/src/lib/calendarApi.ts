import { CATEGORIES, type CalendarEvent, type EventCategory } from '../types/calendar';

export interface CalendarSnapshot {
  members: string[];
  events: CalendarEvent[];
}

export interface NewEventRequest {
  date: string;
  title: string;
  category: EventCategory;
  owner: string;
  invited: string[];
  /** 行き先。'' なら場所なし */
  place: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failureMessage = (body: unknown, status: number): string => {
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  throw new Error(
    `calendarApi: HTTP ${status} の失敗応答に error 文字列がありません: ${JSON.stringify(body)}`,
  );
};

const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  const res = await fetch(path, { cache: 'no-store', ...init });
  if (res.status === 204) return undefined;
  const body: unknown = await res.json();
  if (!res.ok) throw new Error(failureMessage(body, res.status));
  return body;
};

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const asEvent = (body: unknown): CalendarEvent => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.date !== 'string' ||
    typeof body.title !== 'string' ||
    typeof body.category !== 'string' ||
    !Array.isArray(body.owners) ||
    typeof body.place !== 'string'
  ) {
    throw new Error(`calendarApi: 予定の応答形式が不正です: ${JSON.stringify(body)}`);
  }
  if (!CATEGORIES.includes(body.category as EventCategory)) {
    throw new Error(`calendarApi: 予定の種類が不正です: ${JSON.stringify(body.category)}`);
  }
  const owners = body.owners.map((owner) => {
    if (typeof owner !== 'string') {
      throw new Error(`calendarApi: 所有者の形式が不正です: ${JSON.stringify(body.owners)}`);
    }
    return owner;
  });
  return {
    id: body.id,
    date: body.date,
    title: body.title,
    category: body.category as EventCategory,
    owners,
    place: body.place,
  };
};

export const asCalendarSnapshot = (body: unknown): CalendarSnapshot => {
  if (!isRecord(body) || !Array.isArray(body.members) || !Array.isArray(body.events)) {
    throw new Error(`calendarApi: 予定の応答形式が不正です: ${JSON.stringify(body)}`);
  }
  const members = body.members.map((name) => {
    if (typeof name !== 'string') {
      throw new Error(`calendarApi: メンバーの形式が不正です: ${JSON.stringify(body.members)}`);
    }
    return name;
  });
  return { members, events: body.events.map((event) => asEvent(event)) };
};

export const fetchCalendar = async (): Promise<CalendarSnapshot> =>
  asCalendarSnapshot(await request('/api/calendar'));

export const createMember = async (name: string): Promise<string[]> => {
  const body = await request('/api/members', jsonInit('POST', { name }));
  if (!isRecord(body) || !Array.isArray(body.members)) {
    throw new Error(`calendarApi: メンバーの応答形式が不正です: ${JSON.stringify(body)}`);
  }
  return body.members.map((member) => {
    if (typeof member !== 'string') {
      throw new Error(`calendarApi: メンバーの形式が不正です: ${JSON.stringify(body.members)}`);
    }
    return member;
  });
};

export const createEvent = async (body: NewEventRequest): Promise<CalendarEvent> =>
  asEvent(await request('/api/events', jsonInit('POST', body)));

export const joinEvent = async (id: string, user: string): Promise<CalendarEvent> =>
  asEvent(await request(`/api/events/${encodeURIComponent(id)}/join`, jsonInit('POST', { user })));

export const leaveEvent = async (id: string, user: string): Promise<CalendarEvent | null> => {
  const body = await request(`/api/events/${encodeURIComponent(id)}/leave`, jsonInit('POST', { user }));
  if (!isRecord(body) || !('event' in body)) {
    throw new Error(`calendarApi: 予定の応答形式が不正です: ${JSON.stringify(body)}`);
  }
  if (body.event === null) return null;
  return asEvent(body.event);
};

export const resetDemo = async (): Promise<unknown> =>
  request('/api/reset', { method: 'POST' });
