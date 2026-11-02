import { useEffect, useRef, useState } from 'react';
import {
  asCalendarSnapshot,
  createEvent,
  createMember,
  fetchCalendar,
  joinEvent as joinEventRequest,
  leaveEvent,
  resetDemo,
  type CalendarSnapshot,
} from '../lib/calendarApi';
import {
  asLedgerSnapshot,
  createLedgerEntry,
  deleteLedgerEntry,
  fetchLedger,
  putMonthlyGoal,
  type LedgerSnapshot,
} from '../lib/ledgerApi';
import { loadCurrentUser, saveCurrentUser } from '../lib/storage';
import type { CalendarEvent, EventCategory } from '../types/calendar';
import type { LedgerEntry, LedgerKind, MonthlyGoals } from '../types/ledger';

export interface NewEventInput {
  date: string;
  title: string;
  category: EventCategory;
  /** 誘うメンバー。自分と一緒に所有者になる */
  invited: string[];
  /** 行き先。'' なら場所なし */
  place: string;
}

export interface NewLedgerInput {
  date: string;
  kind: LedgerKind;
  amount: number;
  title: string;
}

export interface SharedCalendar {
  members: string[];
  currentUser: string | null;
  events: CalendarEvent[];
  ledger: LedgerEntry[];
  goals: MonthlyGoals;
  /** 予定と家計の初回読み込みが成功するまで false */
  calendarReady: boolean;
  ledgerReady: boolean;
  /** 読み込みに失敗したときのメッセージ。成功時は null */
  ledgerError: string | null;
  login: (name: string) => Promise<void>;
  logout: () => void;
  addEvent: (input: NewEventInput) => Promise<void>;
  /** 他のメンバーの予定に自分も参加する（共有の予定になる） */
  joinEvent: (eventId: string) => Promise<void>;
  /** 自分の予定を消す。共有の予定なら自分だけ抜け、他のメンバーの予定として残る */
  removeEvent: (eventId: string) => Promise<void>;
  addLedgerEntry: (input: NewLedgerInput) => Promise<void>;
  removeLedgerEntry: (entryId: string) => Promise<void>;
  setMonthlyGoal: (year: number, month: number, amount: number) => Promise<void>;
  /** 予定と家計をサーバーのサンプルに戻す */
  resetToSample: () => Promise<void>;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const POLL_MS = 2000;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * 同じサーバーを開いたブラウザで共有するカレンダーと家計簿。
 * 予定・メンバー・家計は /api。ログイン中の名前だけこのブラウザに残す。
 * 2 秒ごとに読み直し、内容が変わったときだけ画面を更新する。
 */
export const useSharedCalendar = (): SharedCalendar => {
  const [members, setMembers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(() => loadCurrentUser());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [goals, setGoals] = useState<MonthlyGoals>({});
  const [calendarReady, setCalendarReady] = useState(false);
  const [ledgerReady, setLedgerReady] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const calendarJson = useRef('');
  const ledgerJson = useRef('');
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

  const applyLedger = (snapshot: LedgerSnapshot) => {
    const next = JSON.stringify(snapshot);
    if (next === ledgerJson.current) return;
    ledgerJson.current = next;
    setLedger(snapshot.entries);
    setGoals(snapshot.goals);
  };

  const refresh = async (seen: number) => {
    const [calendarResult, ledgerResult] = await Promise.allSettled([fetchCalendar(), fetchLedger()]);
    if (!alive.current || revision.current !== seen) return;
    const messages: string[] = [];
    if (calendarResult.status === 'rejected') {
      console.error(calendarResult.reason);
      messages.push(errorMessage(calendarResult.reason));
    }
    if (ledgerResult.status === 'rejected') {
      console.error(ledgerResult.reason);
      messages.push(errorMessage(ledgerResult.reason));
    }
    if (messages.length > 0) {
      throw new Error(messages.join('\n'));
    }
    if (calendarResult.status === 'fulfilled') applyCalendar(calendarResult.value);
    if (ledgerResult.status === 'fulfilled') applyLedger(ledgerResult.value);
    setLedgerError(null);
    setCalendarReady(true);
    setLedgerReady(true);
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
        setLedgerError(errorMessage(err));
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

  const login = async (rawName: string) => {
    const name = rawName.trim();
    if (name.length === 0) {
      throw new Error('login: ユーザー名が空です');
    }
    if (!membersRef.current.includes(name)) {
      await afterWrite(async () => {
        await createMember(name);
      });
    }
    saveCurrentUser(name);
    setCurrentUser(name);
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

  const requireLedger = (action: string): void => {
    if (ledgerReady) return;
    if (ledgerError !== null) throw new Error(ledgerError);
    throw new Error(`${action}: 家計簿の読み込みが終わっていません`);
  };

  const addLedgerEntry = ({ date, kind, amount, title }: NewLedgerInput): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('addLedgerEntry: ログインしていません');
    }
    requireLedger('addLedgerEntry');
    if (!DATE_KEY.test(date)) {
      throw new Error(`addLedgerEntry: 日付の形式が不正です: ${date}`);
    }
    if (kind !== 'income' && kind !== 'expense') {
      throw new Error(`addLedgerEntry: 収支の種類が不正です: ${String(kind)}`);
    }
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error(`addLedgerEntry: 金額は 1 円以上の整数にしてください: ${amount}`);
    }
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new Error('addLedgerEntry: タイトルが空です');
    }
    return afterWrite(async () => {
      await createLedgerEntry({ date, kind, amount, title: trimmed, owner: user });
    });
  };

  const removeLedgerEntry = (entryId: string): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('removeLedgerEntry: ログインしていません');
    }
    requireLedger('removeLedgerEntry');
    return afterWrite(async () => {
      await deleteLedgerEntry(entryId, user);
    });
  };

  const setMonthlyGoal = (year: number, month: number, amount: number): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('setMonthlyGoal: ログインしていません');
    }
    requireLedger('setMonthlyGoal');
    if (month < 1 || month > 12) {
      throw new Error(`setMonthlyGoal: 月が不正です: ${month}`);
    }
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error(`setMonthlyGoal: 目標は 1 円以上の整数にしてください: ${amount}`);
    }
    return afterWrite(async () => {
      await putMonthlyGoal({ year, month, amount });
    });
  };

  const resetToSample = (): Promise<void> =>
    afterWrite(async () => {
      const body = await resetDemo();
      asCalendarSnapshot(body);
      asLedgerSnapshot(body);
    }).then(() => {
      saveCurrentUser(null);
      setCurrentUser(null);
    });

  return {
    members,
    currentUser,
    events,
    ledger,
    goals,
    calendarReady,
    ledgerReady,
    ledgerError,
    login,
    logout,
    addEvent,
    joinEvent,
    removeEvent,
    addLedgerEntry,
    removeLedgerEntry,
    setMonthlyGoal,
    resetToSample,
  };
};
