/** 管理プラグインのフォーマット。正はサーバーの server/plugins/<id>/manifest.json */

export type PluginFieldType = 'number' | 'choice' | 'text' | 'longtext' | 'tags';
export type PluginFieldRole = 'progress' | 'memo';

export interface PluginChoiceOption {
  value: string;
  label: string;
}

export interface PluginField {
  id: string;
  label: string;
  /** number と choice は progress（達成計算に使う）。text / longtext / tags は memo（振り返り用） */
  type: PluginFieldType;
  role: PluginFieldRole;
  /** choice のときだけ */
  options?: PluginChoiceOption[];
  /** number のときだけ */
  integer?: boolean;
  min?: number;
  unit?: string;
  placeholder?: string;
}

/** 月ごとに保存するか、マニフェスト固定か */
export type PluginGoalSpec = 'per_period' | { fixed: number };

export interface PluginProgress {
  label: string;
  /** count / sum: / sum_if: / latest: / delta: を + と - でつないだ式 */
  formula: string;
  compare: 'gte' | 'lte';
  goal: PluginGoalSpec;
  unit?: string;
}

export interface PluginManifest {
  id: string;
  title: string;
  fields: PluginField[];
  progress: PluginProgress;
  /** src/src/plugins/effects/index.ts のキー */
  effect: string;
  /** 達成した月の呼び名（例: 黄金郷）。任意 */
  achievedLabel?: string;
}

export type PluginValue = number | string | string[];
export type PluginEntryValues = Record<string, PluginValue>;

export interface PluginEntry {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  owners: string[];
  values: PluginEntryValues;
}

/** 'YYYY-MM' → その月の目標値 */
export type PluginGoals = Record<string, number>;

export interface PluginData {
  manifest: PluginManifest;
  entries: PluginEntry[];
  goals: PluginGoals;
}
