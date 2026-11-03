/**
 * プラグインの指標・目標・進捗の計算。server/plugins.py の
 * compute_metric / evaluate / pick_goal / pick_effect / goal_status と同じ結果を返す純関数。
 * ポーリングした記録と目標から、画面側で月ごとの状態をまとめて出すために使う。
 */
import type {
  PluginEffect,
  PluginEntry,
  PluginGoal,
  PluginManifest,
  PluginMetric,
  PluginStatus,
  SelectRule,
} from '../types/plugins';

const numberValue = (entry: PluginEntry, field: string): number | null => {
  const value = entry.data[field];
  if (value === undefined) return null;
  if (typeof value !== 'number') {
    throw new Error(`pluginStatus: ${field} が数値ではありません: ${JSON.stringify(value)}`);
  }
  return value;
};

const matches = (entry: PluginEntry, rule: SelectRule): boolean => {
  const value = entry.data[rule.field];
  return typeof value === 'string' && rule.values.includes(value);
};

export const computeMetric = (metric: PluginMetric, entries: PluginEntry[]): number | null => {
  const where = metric.where;
  const scoped = where === undefined ? entries : entries.filter((entry) => matches(entry, where));
  if (metric.agg === 'count') return scoped.length;
  const field = metric.field;
  if (field === undefined) {
    throw new Error(`pluginStatus: ${metric.key} に field がありません`);
  }
  const rule = metric.negateWhen;
  const values: number[] = [];
  const sorted = [...scoped].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const entry of sorted) {
    const raw = numberValue(entry, field);
    if (raw === null) continue;
    values.push(rule !== undefined && matches(entry, rule) ? -raw : raw);
  }
  if (metric.agg === 'sum') return values.reduce((total, v) => total + v, 0);
  if (values.length === 0) return null;
  if (metric.agg === 'max') return Math.max(...values);
  if (metric.agg === 'min') return Math.min(...values);
  if (metric.agg === 'avg') return values.reduce((total, v) => total + v, 0) / values.length;
  if (metric.agg === 'delta') return values[values.length - 1] - values[0];
  return values[values.length - 1];
};

export const evaluate = (
  op: '>=' | '<=',
  value: number | null,
  target: number,
): { achieved: boolean; progress: number } => {
  if (value === null) return { achieved: false, progress: 0 };
  if (op === '>=') {
    const achieved = value >= target;
    const progress = achieved ? 1 : target > 0 ? Math.max(0, value / target) : 0;
    return { achieved, progress: Math.min(1, progress) };
  }
  const achieved = value <= target;
  if (achieved) return { achieved, progress: 1 };
  // 目標が負（-3 kg など）のときは、目標へどれだけ近づいたかで測る
  const progress =
    target < 0 ? (value < 0 ? Math.max(0, value / target) : 0) : value > 0 ? Math.max(0, target / value) : 0;
  return { achieved, progress: Math.min(1, progress) };
};

/**
 * at の時点で見せる目標。期間中のものか、直前に終わったもの。
 * 同じ月に目標が 2 つあれば at に近い方。期間まで同じなら後から作った方（上書き）。
 */
export const pickGoal = (goals: PluginGoal[], at: string): PluginGoal | null => {
  let best: PluginGoal | null = null;
  let bestKey: [string, string, number] | null = null;
  goals.forEach((goal, index) => {
    if (goal.start > at) return;
    const key: [string, string, number] = [goal.end < at ? goal.end : at, goal.start, index];
    if (
      bestKey === null ||
      key[0] > bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))
    ) {
      best = goal;
      bestKey = key;
    }
  });
  return best;
};

export const pickEffect = (manifest: PluginManifest, progress: number): string => {
  const reached = manifest.effects.filter((effect) => progress >= effect.minProgress);
  if (reached.length === 0) {
    throw new Error(`pluginStatus: minProgress 0 のエフェクトがありません: ${manifest.id}`);
  }
  return reached.reduce((a, b) => (a.minProgress >= b.minProgress ? a : b)).id;
};

export const effectById = (manifest: PluginManifest, id: string): PluginEffect => {
  const effect = manifest.effects.find((e) => e.id === id);
  if (effect === undefined) {
    throw new Error(`pluginStatus: ${manifest.id} にエフェクト ${id} がありません`);
  }
  return effect;
};


export const statusAt = (
  manifest: PluginManifest,
  goals: PluginGoal[],
  entries: PluginEntry[],
  at: string,
): PluginStatus => {
  const goal = pickGoal(goals, at);
  if (goal === null) {
    return {
      at,
      goal: null,
      op: manifest.goal.op,
      value: null,
      progress: 0,
      achieved: false,
      finished: false,
      effect: pickEffect(manifest, 0),
    };
  }
  const metric = manifest.metrics.find((m) => m.key === goal.metric);
  if (metric === undefined) {
    throw new Error(`pluginStatus: ${goal.metric} は ${manifest.id} の指標ではありません`);
  }
  const until = goal.end < at ? goal.end : at;
  const inRange = entries.filter((entry) => entry.date >= goal.start && entry.date <= until);
  const value = computeMetric(metric, inRange);
  const op = metric.op ?? manifest.goal.op;
  const { achieved, progress } = evaluate(op, value, goal.target);
  return { at, goal, op, value, progress, achieved, finished: goal.end <= at, effect: pickEffect(manifest, progress) };
};

/** 指標の定義。key を省くと既定の目標の指標（manifest.goal.metric） */
export const goalMetric = (manifest: PluginManifest, key: string = manifest.goal.metric): PluginMetric => {
  const metric = manifest.metrics.find((m) => m.key === key);
  if (metric === undefined) {
    throw new Error(`pluginStatus: 指標が metrics にありません: ${key}`);
  }
  return metric;
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 月の最終日 'YYYY-MM-DD'。その月の島に見せる状態の基準日 */
export const monthEndKey = (year: number, month: number): string =>
  `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;

export const monthStartKey = (year: number, month: number): string => `${year}-${pad2(month)}-01`;

export const formatMetricValue = (value: number, unit: string | undefined): string =>
  `${value.toLocaleString('ja-JP')}${unit ?? ''}`;
