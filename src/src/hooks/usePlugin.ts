import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PLUGIN_ID,
  createPluginEntry,
  createPluginGoal,
  createPluginGroup,
  deletePluginEntry,
  deletePluginGoal,
  fetchPluginState,
  fetchPlugins,
  setPluginInstalled,
} from '../lib/pluginApi';
import { loadIslandsFor } from '../lib/islands';
import type { PluginData, PluginGroup, PluginState, PluginSummary } from '../types/plugins';

export interface NewPluginEntryInput {
  date: string;
  /** plugin.json の fields に合わせた値。検証はサーバーが行う */
  data: PluginData;
}

export interface NewPluginGoalInput {
  /** 目標にする指標の key */
  metric: string;
  start: string;
  end: string;
  target: number;
  label: string;
}

export interface PluginHandle {
  /** 表示中のプラグインと、島の持ち主のグループの記録・目標。初回読み込みが成功するまで null */
  state: PluginState | null;
  /** plugins/ に置いてあるプラグインの一覧（未インストールも含む） */
  plugins: PluginSummary[];
  /** 表示中のプラグイン id（読み込みに失敗していても分かる） */
  selectedId: string;
  /** プラグインの読み込みに失敗したときのメッセージ。地図は止めずパネルに出す。成功時は null */
  error: string | null;
  /** 表示するプラグインを切り替える（インストール済みだけ） */
  select: (pluginId: string) => Promise<void>;
  /** インストール・アンインストールする。表示中のものを外したら、ほかのインストール済みへ切り替える */
  setInstalled: (pluginId: string, installed: boolean) => Promise<void>;
  /** 表示中プラグインで、自分だけのグループを作る */
  startGroup: () => Promise<void>;
  addEntry: (input: NewPluginEntryInput) => Promise<void>;
  removeEntry: (entryId: string) => Promise<void>;
  addGoal: (input: NewPluginGoalInput) => Promise<void>;
  removeGoal: (goalId: string) => Promise<void>;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const POLL_MS = 2000;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * 管理内容プラグイン。表示するのは 1 つだけで、島のテーマもそのプラグインの達成で決める。
 * owner（今見ている島の持ち主。自分か友達）が入っているグループの記録と目標を 2 秒ごとに読み直す。
 * 書き込み（記録・目標・グループ作成）はログイン中の currentUser として行う。
 */
export const usePlugin = (currentUser: string | null, owner: string | null): PluginHandle => {
  const [state, setState] = useState<PluginState | null>(null);
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [selectedId, setSelectedId] = useState(DEFAULT_PLUGIN_ID);
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef(DEFAULT_PLUGIN_ID);
  const ownerRef = useRef(owner);
  const userRef = useRef(currentUser);
  const stateRef = useRef<PluginState | null>(null);
  const stateJson = useRef('');
  const listJson = useRef('');
  const errorRef = useRef<string | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    userRef.current = currentUser;
  }, [currentUser]);

  const applyState = (next: PluginState | null) => {
    const json = JSON.stringify(next);
    if (json === stateJson.current) return;
    stateJson.current = json;
    stateRef.current = next;
    setState(next);
  };

  const refresh = async (seen: number) => {
    const who = ownerRef.current;
    try {
      const listed = await fetchPlugins();
      const installed = listed.filter((p) => p.installed);
      if (installed.length === 0) {
        throw new Error('usePlugin: インストール済みのプラグインがありません。設定の「プラグイン」からインストールしてください');
      }
      // 表示中のものが外されていたら（別の端末でアンインストールした等）、先頭のインストール済みを表示する
      const shown = installed.find((p) => p.manifest.id === selectedRef.current) ?? installed[0];
      const manifest = shown.manifest;
      await loadIslandsFor(manifest);
      const next = who === null ? null : await fetchPluginState(manifest, who);
      if (!alive.current || revision.current !== seen || ownerRef.current !== who) return;
      if (manifest.id !== selectedRef.current) {
        selectedRef.current = manifest.id;
        setSelectedId(manifest.id);
      }
      const list: PluginSummary[] = listed.map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        description: p.manifest.description ?? '',
        installed: p.installed,
      }));
      const json = JSON.stringify(list);
      if (json !== listJson.current) {
        listJson.current = json;
        setPlugins(list);
      }
      applyState(next);
      errorRef.current = null;
      setError(null);
    } catch (err) {
      if (!alive.current || revision.current !== seen) return;
      // プラグインの失敗では地図を止めない。エラー全文をパネルに出し、直るまで読み直し続ける
      const message = errorMessage(err);
      if (message !== errorRef.current) console.error(err);
      errorRef.current = message;
      setError(message);
      applyState(null);
    }
  };

  // 持ち主が変わったら（ログイン・友達の島へ移動）すぐ読み直し、その後は 2 秒ごと
  useEffect(() => {
    ownerRef.current = owner;
    alive.current = true;
    revision.current += 1;
    applyState(null);
    const tick = () => {
      void refresh(revision.current);
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
    };
  }, [owner]);

  const afterWrite = async (run: () => Promise<unknown>): Promise<void> => {
    revision.current += 1;
    await run();
    revision.current += 1;
    await refresh(revision.current);
  };

  const requireUser = (action: string): string => {
    const user = userRef.current;
    if (user === null) {
      throw new Error(`${action}: ログインしていません`);
    }
    return user;
  };

  /** 書き込み先は自分のグループ。友達の島を見ている間は書けない */
  const requireOwnGroup = (action: string): { pluginId: string; group: PluginGroup; user: string } => {
    const user = requireUser(action);
    const current = stateRef.current;
    if (current === null) {
      throw new Error(`${action}: プラグインの読み込みが終わっていません`);
    }
    if (current.group === null || !current.group.members.includes(user)) {
      throw new Error(`${action}: ${current.manifest.name} の自分のグループがありません`);
    }
    return { pluginId: current.manifest.id, group: current.group, user };
  };

  const select = (pluginId: string): Promise<void> => {
    if (!plugins.some((p) => p.id === pluginId && p.installed)) {
      throw new Error(`usePlugin.select: インストール済みのプラグインではありません: ${pluginId}`);
    }
    selectedRef.current = pluginId;
    setSelectedId(pluginId);
    applyState(null);
    return afterWrite(async () => undefined);
  };

  const setInstalled = (pluginId: string, installed: boolean): Promise<void> => {
    if (!plugins.some((p) => p.id === pluginId)) {
      throw new Error(`usePlugin.setInstalled: プラグインが見つかりません: ${pluginId}`);
    }
    if (!installed && !plugins.some((p) => p.id !== pluginId && p.installed)) {
      throw new Error('最後のプラグインはアンインストールできません');
    }
    return afterWrite(() => setPluginInstalled(pluginId, installed));
  };

  const startGroup = (): Promise<void> => {
    const user = requireUser('startGroup');
    const current = stateRef.current;
    if (current === null) {
      throw new Error('startGroup: プラグインの読み込みが終わっていません');
    }
    return afterWrite(() => createPluginGroup(current.manifest.id, `${user}の${current.manifest.name}`, user));
  };

  const addEntry = ({ date, data }: NewPluginEntryInput): Promise<void> => {
    const { pluginId, group, user } = requireOwnGroup('addEntry');
    if (!DATE_KEY.test(date)) {
      throw new Error(`addEntry: 日付の形式が不正です: ${date}`);
    }
    return afterWrite(() => createPluginEntry(pluginId, group.id, { date, data, owner: user }));
  };

  const removeEntry = (entryId: string): Promise<void> => {
    const { pluginId, group, user } = requireOwnGroup('removeEntry');
    return afterWrite(() => deletePluginEntry(pluginId, group.id, entryId, user));
  };

  const addGoal = ({ metric, start, end, target, label }: NewPluginGoalInput): Promise<void> => {
    const { pluginId, group, user } = requireOwnGroup('addGoal');
    if (!DATE_KEY.test(start) || !DATE_KEY.test(end)) {
      throw new Error(`addGoal: 期間の形式が不正です: ${start} 〜 ${end}`);
    }
    if (start > end) {
      throw new Error('addGoal: 開始は終了以前にしてください');
    }
    if (!Number.isFinite(target)) {
      throw new Error(`addGoal: 目標は数値にしてください: ${target}`);
    }
    return afterWrite(() =>
      createPluginGoal(pluginId, group.id, { user, metric, start, end, target, label: label.trim() }),
    );
  };

  const removeGoal = (goalId: string): Promise<void> => {
    const { pluginId, group, user } = requireOwnGroup('removeGoal');
    return afterWrite(() => deletePluginGoal(pluginId, group.id, goalId, user));
  };

  return { state, plugins, selectedId, error, select, setInstalled, startGroup, addEntry, removeEntry, addGoal, removeGoal };
};
