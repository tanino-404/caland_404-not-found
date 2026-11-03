import type {
  PluginData,
  PluginEntry,
  PluginGoal,
  PluginGroup,
  PluginManifest,
  PluginState,
  PluginSummary,
} from '../types/plugins';
import { assertKnownEffects } from './effects';

/** 最初に表示する管理内容プラグイン */
export const DEFAULT_PLUGIN_ID = 'ledger';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failureMessage = (body: unknown, status: number): string => {
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  throw new Error(
    `pluginApi: HTTP ${status} の失敗応答に error 文字列がありません: ${JSON.stringify(body)}`,
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

const formatError = (what: string, body: unknown): Error =>
  new Error(`pluginApi: ${what}の応答形式が不正です: ${JSON.stringify(body)}`);

const asStringArray = (what: string, value: unknown): string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw formatError(what, value);
  }
  return value as string[];
};

const asManifest = (body: unknown): PluginManifest => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.name !== 'string' ||
    !Array.isArray(body.fields) ||
    !Array.isArray(body.metrics) ||
    !isRecord(body.goal) ||
    !Array.isArray(body.effects)
  ) {
    throw formatError('プラグイン定義', body);
  }
  // 詳細な検証はサーバー（plugins.py）が配信前に済ませている。ここでは形だけ確かめる
  const manifest = body as unknown as PluginManifest;
  assertKnownEffects(manifest);
  return manifest;
};

const asGroup = (body: unknown): PluginGroup => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.pluginId !== 'string' ||
    typeof body.name !== 'string'
  ) {
    throw formatError('グループ', body);
  }
  return {
    id: body.id,
    pluginId: body.pluginId,
    name: body.name,
    members: asStringArray('グループのメンバー', body.members),
  };
};

const asEntry = (body: unknown): PluginEntry => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.pluginId !== 'string' ||
    typeof body.groupId !== 'string' ||
    typeof body.date !== 'string' ||
    !isRecord(body.data)
  ) {
    throw formatError('記録', body);
  }
  return {
    id: body.id,
    pluginId: body.pluginId,
    groupId: body.groupId,
    date: body.date,
    data: body.data as PluginData,
    owners: asStringArray('記録の owners', body.owners),
  };
};

const asGoal = (body: unknown): PluginGoal => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.metric !== 'string' ||
    typeof body.label !== 'string' ||
    typeof body.start !== 'string' ||
    typeof body.end !== 'string' ||
    typeof body.target !== 'number'
  ) {
    throw formatError('目標', body);
  }
  return {
    id: body.id,
    pluginId: String(body.pluginId),
    groupId: String(body.groupId),
    metric: body.metric,
    label: body.label,
    start: body.start,
    end: body.end,
    target: body.target,
  };
};

const listOf = <T>(what: string, body: unknown, key: string, each: (item: unknown) => T): T[] => {
  if (!isRecord(body) || !Array.isArray(body[key])) throw formatError(what, body);
  return (body[key] as unknown[]).map(each);
};

const groupPath = (pluginId: string, groupId: string): string =>
  `/api/plugins/${encodeURIComponent(pluginId)}/groups/${encodeURIComponent(groupId)}`;

/** 置いてあるプラグインの定義をすべて読む */
export const fetchManifests = async (): Promise<PluginManifest[]> =>
  listOf('プラグイン一覧', await request('/api/plugins'), 'plugins', asManifest);

/** プラグインの先頭グループの記録と目標をまとめて読む */
export const fetchPluginState = async (manifest: PluginManifest): Promise<PluginState> => {
  const groups = listOf('グループ一覧', await request(`/api/plugins/${encodeURIComponent(manifest.id)}/groups`), 'groups', asGroup);
  if (groups.length === 0) {
    throw new Error(`pluginApi: ${manifest.name}（${manifest.id}）にグループがありません`);
  }
  const group = groups[0];
  const [entriesBody, goalsBody] = await Promise.all([
    request(`${groupPath(manifest.id, group.id)}/entries`),
    request(`${groupPath(manifest.id, group.id)}/goals`),
  ]);
  const entries = listOf('記録一覧', entriesBody, 'entries', asEntry);
  const goals = listOf('目標一覧', goalsBody, 'goals', asGoal);
  return { manifest, group, entries, goals };
};

export const joinPluginGroup = async (pluginId: string, groupId: string, member: string): Promise<void> => {
  await request(`${groupPath(pluginId, groupId)}/members`, jsonInit('POST', { member }));
};

export const createPluginEntry = async (
  pluginId: string,
  groupId: string,
  body: { date: string; data: PluginData; owner: string },
): Promise<PluginEntry> => asEntry(await request(`${groupPath(pluginId, groupId)}/entries`, jsonInit('POST', body)));

export const deletePluginEntry = async (pluginId: string, groupId: string, id: string, user: string): Promise<void> => {
  await request(`${groupPath(pluginId, groupId)}/entries/${encodeURIComponent(id)}?user=${encodeURIComponent(user)}`, {
    method: 'DELETE',
  });
};

export const createPluginGoal = async (
  pluginId: string,
  groupId: string,
  body: { user: string; metric: string; start: string; end: string; target: number; label: string },
): Promise<PluginGoal> => asGoal(await request(`${groupPath(pluginId, groupId)}/goals`, jsonInit('POST', body)));

export const deletePluginGoal = async (pluginId: string, groupId: string, id: string, user: string): Promise<void> => {
  await request(`${groupPath(pluginId, groupId)}/goals/${encodeURIComponent(id)}?user=${encodeURIComponent(user)}`, {
    method: 'DELETE',
  });
};

/** 月（1〜12）→ その月末に目標を達成しているプラグイン */
export const fetchAchievements = async (year: number): Promise<Map<number, PluginSummary[]>> => {
  const body = await request(`/api/achievements?year=${year}`);
  if (!isRecord(body) || !isRecord(body.months)) throw formatError('達成一覧', body);
  const months = new Map<number, PluginSummary[]>();
  for (const [key, list] of Object.entries(body.months)) {
    if (!Array.isArray(list)) throw formatError('達成一覧', body);
    months.set(
      Number(key),
      list.map((item) => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
          throw formatError('達成したプラグイン', item);
        }
        return { id: item.id, name: item.name };
      }),
    );
  }
  return months;
};
