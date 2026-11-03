import { useEffect, useRef, useState } from 'react';
import {
  asCalendarSnapshot,
  createEvent,
  fetchCalendar,
  joinEvent as joinEventRequest,
  leaveEvent,
  loginMember,
  registerMember,
  resetDemo,
  type CalendarSnapshot,
} from '../lib/calendarApi';
import { loadCurrentUser, saveCurrentUser } from '../lib/storage';
import type { CalendarEvent, EventCategory } from '../types/calendar';

export interface NewEventInput {
  date: string;
  title: string;
  category: EventCategory;
  /** 誘うメンバー。自分と一緒に所有者になる */
  invited: string[];
  /** 行き先。'' なら場所なし */
  place: string;
}

export interface SharedCalendar {
  members: string[];
  currentUser: string | null;
  events: CalendarEvent[];
  /** 初回読み込みが成功するまで false */
  ready: boolean;
  /** 読み込みに失敗したときのメッセージ。成功時は null */
  error: string | null;
  /** 登録済みの ID（名前）とパスワードでログイン。失敗はサーバーのメッセージの Error */
  login: (name: string, password: string) => Promise<void>;
  /** 新しい ID を登録してそのままログイン。既存の ID なら Error */
  register: (name: string, password: string) => Promise<void>;
  logout: () => void;
  addEvent: (input: NewEventInput) => Promise<void>;
  /** 他のメンバーの予定に自分も参加する（共有の予定になる） */
  joinEvent: (eventId: string) => Promise<void>;
  /** 自分の予定を消す。共有の予定なら自分だけ抜け、他のメンバーの予定として残る */
  removeEvent: (eventId: string) => Promise<void>;
  /** 予定と管理プラグインの記録をサーバーのサンプルに戻す（プラグイン側は usePlugin のポーリングで追従する） */
  resetToSample: () => Promise<void>;
}

const POLL_MS = 2000;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * 同じサーバーを開いたブラウザで共有するカレンダー。
 * 予定・メンバーは /api/calendar。ログイン中の名前だけこのブラウザに残す。
 * 2 秒ごとに読み直し、内容が変わったときだけ画面を更新する。
 */
export const useSharedCalendar = (): SharedCalendar => {
  const [members, setMembers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(() => loadCurrentUser());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const calendarJson = useRef('');
  const membersRef = useRef<string[]>([]);
  const userRef = useRef<string | null>(currentUser);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    userRef.current = currentUser;
  }, [currentUser]);

  const applyCalendar = (snapshot: CalendarSnapshot) => {
    const next = JSON.stringify(snapshot);
    if (next === calendarJson.current) return;
    calendarJson.current = next;
    setMembers(snapshot.members);
    setEvents(snapshot.events);
    const user = userRef.current;
    if (user !== null && !snapshot.members.includes(user)) {
      saveCurrentUser(null);
      setCurrentUser(null);
    }
  };

  const refresh = async (seen: number) => {
    const snapshot = await fetchCalendar();
    if (!alive.current || revision.current !== seen) return;
    applyCalendar(snapshot);
    setError(null);
    setReady(true);
  };

  useEffect(() => {
    alive.current = true;
    let active = true;
    let timer = 0;
    const tick = () => {
      const seen = revision.current;
      refresh(seen).catch((err: unknown) => {
        if (!active || revision.current !== seen) return;
        console.error(err);
        window.clearInterval(timer);
        setError(errorMessage(err));
      });
    };
    tick();
    timer = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      alive.current = false;
      window.clearInterval(timer);
    };
  }, []);

  const afterWrite = async (run: () => Promise<void>): Promise<void> => {
    revision.current += 1;
    await run();
    revision.current += 1;
    await refresh(revision.current);
  };

  const login = async (rawName: string, password: string) => {
    const name = rawName.trim();
    if (name.length === 0) {
      throw new Error('login: ユーザー名が空です');
    }
    const accepted = await loginMember(name, password);
    saveCurrentUser(accepted);
    setCurrentUser(accepted);
  };

  const register = async (rawName: string, password: string) => {
    const name = rawName.trim();
    if (name.length === 0) {
      throw new Error('register: ユーザー名が空です');
    }
    let accepted = '';
    await afterWrite(async () => {
      accepted = await registerMember(name, password);
    });
    saveCurrentUser(accepted);
    setCurrentUser(accepted);
  };

  const logout = () => {
    saveCurrentUser(null);
    setCurrentUser(null);
  };

  const addEvent = async ({ date, title, category, invited, place }: NewEventInput) => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('addEvent: ログインしていません');
    }
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new Error('addEvent: タイトルが空です');
    }
    for (const name of invited) {
      if (!membersRef.current.includes(name)) {
        throw new Error(`addEvent: 未登録のメンバーを誘っています: "${name}"`);
      }
    }
    await afterWrite(async () => {
      await createEvent({ date, title: trimmed, category, owner: user, invited, place: place.trim() });
    });
  };

  const joinEvent = async (eventId: string) => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('joinEvent: ログインしていません');
    }
    await afterWrite(async () => {
      await joinEventRequest(eventId, user);
    });
  };

  const removeEvent = async (eventId: string) => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('removeEvent: ログインしていません');
    }
    await afterWrite(async () => {
      await leaveEvent(eventId, user);
    });
  };

  const resetToSample = (): Promise<void> =>
    afterWrite(async () => {
      const body = await resetDemo();
      asCalendarSnapshot(body);
    }).then(() => {
      saveCurrentUser(null);
      setCurrentUser(null);
    });

  return {
    members,
    currentUser,
    events,
    ready,
    error,
    login,
    register,
    logout,
    addEvent,
    joinEvent,
    removeEvent,
    resetToSample,
  };
};
