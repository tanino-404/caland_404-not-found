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
  DEFAULT_PLUGIN_ID,
  createPluginEntry,
  createPluginGoal,
  deletePluginEntry,
  deletePluginGoal,
  fetchManifests,
  fetchPluginState,
  joinPluginGroup,
} from '../lib/pluginApi';
import { loadCurrentUser, saveCurrentUser } from '../lib/storage';
import type { CalendarEvent, EventCategory } from '../types/calendar';
import type { PluginData, PluginState, PluginSummary } from '../types/plugins';

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
  /** plugin.json の fields に合わせた値。検証はサーバーが行う */
  data: PluginData;
}

export interface NewPluginGoalInput {
  start: string;
  end: string;
  target: number;
  label: string;
}

export interface SharedCalendar {
  members: string[];
  currentUser: string | null;
  events: CalendarEvent[];
  /** 表示する管理内容プラグイン。初回読み込みが成功するまで null */
  plugin: PluginState | null;
  /** 切り替えられるプラグインの一覧 */
  plugins: PluginSummary[];
  /** 表示するプラグインを切り替える */
  selectPlugin: (pluginId: string) => Promise<void>;
  /** 表示中プラグインのグループに自分も入る */
  joinPluginGroup: () => Promise<void>;
  /** 予定の初回読み込みが成功するまで false */
  calendarReady: boolean;
  /** 読み込みに失敗したときのメッセージ。成功時は null */
  loadError: string | null;
  login: (name: string) => Promise<void>;
  logout: () => void;
  addEvent: (input: NewEventInput) => Promise<void>;
  /** 他のメンバーの予定に自分も参加する（共有の予定になる） */
  joinEvent: (eventId: string) => Promise<void>;
  /** 自分の予定を消す。共有の予定なら自分だけ抜け、他のメンバーの予定として残る */
  removeEvent: (eventId: string) => Promise<void>;
  addPluginEntry: (input: NewPluginEntryInput) => Promise<void>;
  removePluginEntry: (entryId: string) => Promise<void>;
  addPluginGoal: (input: NewPluginGoalInput) => Promise<void>;
  removePluginGoal: (goalId: string) => Promise<void>;
  /** 予定とプラグインの記録をサーバーのサンプルに戻す */
  resetToSample: () => Promise<void>;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const POLL_MS = 2000;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * 同じサーバーを開いたブラウザで共有するカレンダーと管理内容プラグイン。
 * 予定・メンバー・記録・目標は /api。ログイン中の名前だけこのブラウザに残す。
 * 2 秒ごとに読み直し、内容が変わったときだけ画面を更新する。
 */
export const useSharedCalendar = (): SharedCalendar => {
  const [members, setMembers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(() => loadCurrentUser());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [plugin, setPlugin] = useState<PluginState | null>(null);
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const selectedId = useRef(DEFAULT_PLUGIN_ID);
  const pluginsJson = useRef('');
  const [calendarReady, setCalendarReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const calendarJson = useRef('');
  const pluginJson = useRef('');
  const membersRef = useRef<string[]>([]);
  const pluginRef = useRef<PluginState | null>(null);
  const userRef = useRef<string | null>(currentUser);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    pluginRef.current = plugin;
  }, [plugin]);

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

  const applyPlugin = (state: PluginState) => {
    const next = JSON.stringify(state);
    if (next === pluginJson.current) return;
    pluginJson.current = next;
    setPlugin(state);
    pluginRef.current = state;
  };

  const loadSelectedPlugin = async (): Promise<{ list: PluginSummary[]; state: PluginState }> => {
    const manifests = await fetchManifests();
    const manifest = manifests.find((m) => m.id === selectedId.current);
    if (manifest === undefined) {
      throw new Error(`useSharedCalendar: プラグインが見つかりません: ${selectedId.current}`);
    }
    return { list: manifests.map((m) => ({ id: m.id, name: m.name })), state: await fetchPluginState(manifest) };
  };

  const applyPluginList = (list: PluginSummary[]) => {
    const next = JSON.stringify(list);
    if (next === pluginsJson.current) return;
    pluginsJson.current = next;
    setPlugins(list);
  };

  const refresh = async (seen: number) => {
    const [calendarResult, pluginResult] = await Promise.allSettled([fetchCalendar(), loadSelectedPlugin()]);
    if (!alive.current || revision.current !== seen) return;
    const messages: string[] = [];
    if (calendarResult.status === 'rejected') {
      console.error(calendarResult.reason);
      messages.push(errorMessage(calendarResult.reason));
    }
    if (pluginResult.status === 'rejected') {
      console.error(pluginResult.reason);
      messages.push(errorMessage(pluginResult.reason));
    }
    if (messages.length > 0) {
      throw new Error(messages.join('\n'));
    }
    if (calendarResult.status === 'fulfilled') applyCalendar(calendarResult.value);
    if (pluginResult.status === 'fulfilled') {
      applyPluginList(pluginResult.value.list);
      applyPlugin(pluginResult.value.state);
    }
    setLoadError(null);
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
        setLoadError(errorMessage(err));
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

  const requirePlugin = (action: string): PluginState => {
    const state = pluginRef.current;
    if (state === null) {
      throw new Error(`${action}: プラグインの読み込みが終わっていません`);
    }
    return state;
  };

  const requireUser = (action: string): string => {
    const user = userRef.current;
    if (user === null) {
      throw new Error(`${action}: ログインしていません`);
    }
    return user;
  };

  const login = async (rawName: string) => {
    const name = rawName.trim();
    if (name.length === 0) {
      throw new Error('login: ユーザー名が空です');
    }
    const state = requirePlugin('login');
    if (!membersRef.current.includes(name) || !state.group.members.includes(name)) {
      await afterWrite(async () => {
        await createMember(name);
        await joinPluginGroup(state.manifest.id, state.group.id, name);
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
    const user = requireUser('addEvent');
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
    const user = requireUser('joinEvent');
    await afterWrite(async () => {
      await joinEventRequest(eventId, user);
    });
  };

  const removeEvent = async (eventId: string) => {
    const user = requireUser('removeEvent');
    await afterWrite(async () => {
      await leaveEvent(eventId, user);
    });
  };

  const addPluginEntry = ({ date, data }: NewPluginEntryInput): Promise<void> => {
    const user = requireUser('addPluginEntry');
    const state = requirePlugin('addPluginEntry');
    if (!DATE_KEY.test(date)) {
      throw new Error(`addPluginEntry: 日付の形式が不正です: ${date}`);
    }
    return afterWrite(async () => {
      await createPluginEntry(state.manifest.id, state.group.id, { date, data, owner: user });
    });
  };

  const removePluginEntry = (entryId: string): Promise<void> => {
    const user = requireUser('removePluginEntry');
    const state = requirePlugin('removePluginEntry');
    return afterWrite(async () => {
      await deletePluginEntry(state.manifest.id, state.group.id, entryId, user);
    });
  };

  const addPluginGoal = ({ start, end, target, label }: NewPluginGoalInput): Promise<void> => {
    const user = requireUser('addPluginGoal');
    const state = requirePlugin('addPluginGoal');
    if (!DATE_KEY.test(start) || !DATE_KEY.test(end)) {
      throw new Error(`addPluginGoal: 期間の形式が不正です: ${start} 〜 ${end}`);
    }
    if (start > end) {
      throw new Error('addPluginGoal: 開始は終了以前にしてください');
    }
    if (!Number.isFinite(target)) {
      throw new Error(`addPluginGoal: 目標は数値にしてください: ${target}`);
    }
    return afterWrite(async () => {
      await createPluginGoal(state.manifest.id, state.group.id, { user, start, end, target, label: label.trim() });
    });
  };

  const removePluginGoal = (goalId: string): Promise<void> => {
    const user = requireUser('removePluginGoal');
    const state = requirePlugin('removePluginGoal');
    return afterWrite(async () => {
      await deletePluginGoal(state.manifest.id, state.group.id, goalId, user);
    });
  };

  const selectPlugin = (pluginId: string): Promise<void> => {
    if (!plugins.some((p) => p.id === pluginId)) {
      throw new Error(`selectPlugin: プラグインが見つかりません: ${pluginId}`);
    }
    selectedId.current = pluginId;
    return afterWrite(async () => undefined);
  };

  const joinCurrentGroup = (): Promise<void> => {
    const user = requireUser('joinPluginGroup');
    const state = requirePlugin('joinPluginGroup');
    return afterWrite(async () => {
      await joinPluginGroup(state.manifest.id, state.group.id, user);
    });
  };

  const resetToSample = (): Promise<void> =>
    afterWrite(async () => {
      asCalendarSnapshot(await resetDemo());
    }).then(() => {
      saveCurrentUser(null);
      setCurrentUser(null);
    });

  return {
    members,
    currentUser,
    events,
    plugin,
    plugins,
    selectPlugin,
    joinPluginGroup: joinCurrentGroup,
    calendarReady,
    loadError,
    login,
    logout,
    addEvent,
    joinEvent,
    removeEvent,
    addPluginEntry,
    removePluginEntry,
    addPluginGoal,
    removePluginGoal,
    resetToSample,
  };
};
