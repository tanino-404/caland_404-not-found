/** 管理プラグイン API（/api/plugins）。失敗時は Error を投げる。 */

import type {
  PluginData,
  PluginEntry,
  PluginEntryValues,
  PluginField,
  PluginGoals,
  PluginManifest,
} from '../types/plugins';

export interface NewPluginEntryRequest {
  date: string;
  owner: string;
  values: PluginEntryValues;
}

export interface PluginGoalRequest {
  year: number;
  month: number;
  amount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failureMessage = (body: unknown, status: number): string => {
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  throw new Error(
    `pluginsApi: HTTP ${status} の失敗応答に error 文字列がありません: ${JSON.stringify(body)}`,
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

const fail = (what: string, body: unknown): never => {
  throw new Error(`pluginsApi: ${what}の応答形式が不正です: ${JSON.stringify(body)}`);
};

const asField = (body: unknown): PluginField => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.label !== 'string' ||
    (body.type !== 'number' &&
      body.type !== 'choice' &&
      body.type !== 'text' &&
      body.type !== 'longtext' &&
      body.type !== 'tags') ||
    (body.role !== 'progress' && body.role !== 'memo')
  ) {
    return fail('フィールド', body);
  }
  const field: PluginField = {
    id: body.id,
    label: body.label,
    type: body.type,
    role: body.role,
  };
  if (body.options !== undefined) {
    if (!Array.isArray(body.options)) return fail('options', body.options);
    field.options = body.options.map((option) => {
      if (!isRecord(option) || typeof option.value !== 'string' || typeof option.label !== 'string') {
        return fail('option', option);
      }
      return { value: option.value, label: option.label };
    });
  }
  if (body.integer !== undefined) {
    if (typeof body.integer !== 'boolean') return fail('integer', body);
    field.integer = body.integer;
  }
  if (body.min !== undefined) {
    if (typeof body.min !== 'number') return fail('min', body);
    field.min = body.min;
  }
  if (body.unit !== undefined) {
    if (typeof body.unit !== 'string') return fail('unit', body);
    field.unit = body.unit;
  }
  if (body.placeholder !== undefined) {
    if (typeof body.placeholder !== 'string') return fail('placeholder', body);
    field.placeholder = body.placeholder;
  }
  return field;
};

const asManifest = (body: unknown): PluginManifest => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.title !== 'string' ||
    !Array.isArray(body.fields) ||
    !isRecord(body.progress) ||
    typeof body.effect !== 'string'
  ) {
    return fail('マニフェスト', body);
  }
  const progress = body.progress;
  if (
    typeof progress.label !== 'string' ||
    typeof progress.formula !== 'string' ||
    (progress.compare !== 'gte' && progress.compare !== 'lte')
  ) {
    return fail('progress', progress);
  }
  let goal: PluginManifest['progress']['goal'];
  if (progress.goal === 'per_period') {
    goal = 'per_period';
  } else if (isRecord(progress.goal) && typeof progress.goal.fixed === 'number') {
    goal = { fixed: progress.goal.fixed };
  } else {
    return fail('progress.goal', progress.goal);
  }
  const manifest: PluginManifest = {
    id: body.id,
    title: body.title,
    fields: body.fields.map((field) => asField(field)),
    progress: {
      label: progress.label,
      formula: progress.formula,
      compare: progress.compare,
      goal,
    },
    effect: body.effect,
  };
  if (progress.unit !== undefined) {
    if (typeof progress.unit !== 'string') return fail('progress.unit', progress);
    manifest.progress.unit = progress.unit;
  }
  if (body.achievedLabel !== undefined) {
    if (typeof body.achievedLabel !== 'string') return fail('achievedLabel', body);
    manifest.achievedLabel = body.achievedLabel;
  }
  return manifest;
};

const asEntry = (body: unknown): PluginEntry => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.date !== 'string' ||
    !Array.isArray(body.owners) ||
    !isRecord(body.values)
  ) {
    return fail('記帳', body);
  }
  const owners = body.owners.map((owner) => {
    if (typeof owner !== 'string') return fail('記帳者', body.owners);
    return owner;
  });
  const values: PluginEntryValues = {};
  for (const [key, value] of Object.entries(body.values)) {
    if (typeof value === 'number' || typeof value === 'string') {
      values[key] = value;
    } else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      values[key] = value;
    } else {
      return fail(`values.${key}`, value);
    }
  }
  return { id: body.id, date: body.date, owners, values };
};

const asGoals = (body: unknown): PluginGoals => {
  if (!isRecord(body)) return fail('goals', body);
  const goals: PluginGoals = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'number') {
      throw new Error(`pluginsApi: 目標が数値ではありません: ${key}=${JSON.stringify(value)}`);
    }
    goals[key] = value;
  }
  return goals;
};

const asPluginData = (body: unknown): PluginData => {
  if (!isRecord(body) || !Array.isArray(body.entries)) return fail('プラグイン', body);
  return {
    manifest: asManifest(body.manifest),
    entries: body.entries.map((entry) => asEntry(entry)),
    goals: asGoals(body.goals),
  };
};

export const asPluginsList = (body: unknown): PluginData[] => {
  if (!isRecord(body) || !Array.isArray(body.plugins)) return fail('プラグイン一覧', body);
  if (body.plugins.length === 0) {
    throw new Error('pluginsApi: プラグインが 1 つもありません');
  }
  return body.plugins.map((plugin) => asPluginData(plugin));
};

export const fetchPlugins = async (): Promise<PluginData[]> =>
  asPluginsList(await request('/api/plugins'));

export const createPluginEntry = async (
  pluginId: string,
  body: NewPluginEntryRequest,
): Promise<PluginEntry> =>
  asEntry(await request(`/api/plugins/${encodeURIComponent(pluginId)}/entries`, jsonInit('POST', body)));

export const deletePluginEntry = async (
  pluginId: string,
  entryId: string,
  user: string,
): Promise<void> => {
  await request(
    `/api/plugins/${encodeURIComponent(pluginId)}/entries/${encodeURIComponent(entryId)}?user=${encodeURIComponent(user)}`,
    { method: 'DELETE' },
  );
};

export const putPluginGoal = async (pluginId: string, body: PluginGoalRequest): Promise<void> => {
  await request(`/api/plugins/${encodeURIComponent(pluginId)}/goals`, jsonInit('PUT', body));
};
