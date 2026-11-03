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
  asPluginsList,
  createPluginEntry,
  deletePluginEntry,
  fetchPlugins,
  putPluginGoal,
} from '../lib/pluginsApi';
import { loadCurrentUser, saveCurrentUser } from '../lib/storage';
import type { CalendarEvent, EventCategory } from '../types/calendar';
import type { PluginData, PluginEntryValues } from '../types/plugins';

export interface NewEventInput {
  date: string;
  title: string;
  category: EventCategory;
  /** 誘うメンバー。自分と一緒に所有者になる */
  invited: string[];
  /** 行き先。'' なら場所なし */
  place: string;
}

export interface NewPluginEntryInput {
  date: string;
  values: PluginEntryValues;
}

export interface SharedCalendar {
  members: string[];
  currentUser: string | null;
  events: CalendarEvent[];
  /** 管理プラグイン。並びはサーバー（/api/plugins）の順 */
  plugins: PluginData[];
  /** 予定の初回読み込みが成功するまで false */
  calendarReady: boolean;
  /** プラグイン一覧の初回読み込みが成功するまで false */
  pluginsReady: boolean;
  /** 予定の読み込みに失敗したときのメッセージ。地図ごと止める */
  calendarError: string | null;
  /** プラグインの読み込みに失敗したときのメッセージ。地図は残す */
  pluginsError: string | null;
  login: (name: string) => Promise<void>;
  logout: () => void;
  addEvent: (input: NewEventInput) => Promise<void>;
  /** 他のメンバーの予定に自分も参加する（共有の予定になる） */
  joinEvent: (eventId: string) => Promise<void>;
  /** 自分の予定を消す。共有の予定なら自分だけ抜け、他のメンバーの予定として残る */
  removeEvent: (eventId: string) => Promise<void>;
  addPluginEntry: (pluginId: string, input: NewPluginEntryInput) => Promise<void>;
  removePluginEntry: (pluginId: string, entryId: string) => Promise<void>;
  setPluginGoal: (pluginId: string, year: number, month: number, amount: number) => Promise<void>;
  /** 予定と全プラグインをサーバーのサンプルに戻す */
  resetToSample: () => Promise<void>;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const POLL_MS = 2000;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * 同じサーバーを開いたブラウザで共有するカレンダーと管理プラグイン。
 * 予定・メンバー・プラグインは /api。ログイン中の名前だけこのブラウザに残す。
 * 2 秒ごとに読み直し、内容が変わったときだけ画面を更新する。
 */
export const useSharedCalendar = (): SharedCalendar => {
  const [members, setMembers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(() => loadCurrentUser());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [plugins, setPlugins] = useState<PluginData[]>([]);
  const [calendarReady, setCalendarReady] = useState(false);
  const [pluginsReady, setPluginsReady] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const calendarJson = useRef('');
  const pluginsJson = useRef('');
  const membersRef = useRef<string[]>([]);
  const userRef = useRef<string | null>(currentUser);
  const pluginsReadyRef = useRef(false);

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

  const applyPlugins = (list: PluginData[]) => {
    const next = JSON.stringify(list);
    if (next === pluginsJson.current) return;
    pluginsJson.current = next;
    setPlugins(list);
  };

  const refresh = async (seen: number) => {
    const [calendarResult, pluginsResult] = await Promise.allSettled([
      fetchCalendar(),
      fetchPlugins(),
    ]);
    if (!alive.current || revision.current !== seen) return;
    if (pluginsResult.status === 'rejected') {
      console.error(pluginsResult.reason);
      setPluginsError(errorMessage(pluginsResult.reason));
    } else {
      applyPlugins(pluginsResult.value);
      setPluginsError(null);
      setPluginsReady(true);
      pluginsReadyRef.current = true;
    }
    if (calendarResult.status === 'rejected') {
      console.error(calendarResult.reason);
      throw new Error(errorMessage(calendarResult.reason));
    }
    applyCalendar(calendarResult.value);
    setCalendarReady(true);
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
        setCalendarError(errorMessage(err));
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

  const requirePlugins = (action: string): void => {
    if (pluginsReadyRef.current) return;
    if (pluginsError !== null) throw new Error(pluginsError);
    throw new Error(`${action}: 管理データの読み込みが終わっていません`);
  };

  const addPluginEntry = (pluginId: string, { date, values }: NewPluginEntryInput): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('addPluginEntry: ログインしていません');
    }
    requirePlugins('addPluginEntry');
    if (!DATE_KEY.test(date)) {
      throw new Error(`addPluginEntry: 日付の形式が不正です: ${date}`);
    }
    return afterWrite(async () => {
      await createPluginEntry(pluginId, { date, owner: user, values });
    });
  };

  const removePluginEntry = (pluginId: string, entryId: string): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('removePluginEntry: ログインしていません');
    }
    requirePlugins('removePluginEntry');
    return afterWrite(async () => {
      await deletePluginEntry(pluginId, entryId, user);
    });
  };

  const setPluginGoal = (
    pluginId: string,
    year: number,
    month: number,
    amount: number,
  ): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('setPluginGoal: ログインしていません');
    }
    requirePlugins('setPluginGoal');
    if (month < 1 || month > 12) {
      throw new Error(`setPluginGoal: 月が不正です: ${month}`);
    }
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error(`setPluginGoal: 目標は 1 以上の整数にしてください: ${amount}`);
    }
    return afterWrite(async () => {
      await putPluginGoal(pluginId, { year, month, amount });
    });
  };

  const resetToSample = (): Promise<void> =>
    afterWrite(async () => {
      const body = await resetDemo();
      asCalendarSnapshot(body);
      asPluginsList(body);
    }).then(() => {
      saveCurrentUser(null);
      setCurrentUser(null);
    });

  return {
    members,
    currentUser,
    events,
    plugins,
    calendarReady,
    pluginsReady,
    calendarError,
    pluginsError,
    login,
    logout,
    addEvent,
    joinEvent,
    removeEvent,
    addPluginEntry,
    removePluginEntry,
    setPluginGoal,
    resetToSample,
  };
};
