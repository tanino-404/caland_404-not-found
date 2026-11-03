/** 管理プラグインの達成計算（純関数）。server/plugin_store.py と同じ意味にする。 */

import type {
  PluginEntry,
  PluginField,
  PluginGoals,
  PluginManifest,
  PluginValue,
} from '../types/plugins';

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const toYearMonth = (year: number, month: number): string => `${year}-${pad2(month)}`;

type FormulaTerm =
  | { op: 'count' }
  | { op: 'sum' | 'latest' | 'delta'; field: string }
  | { op: 'sum_if'; choice: string; option: string; field: string };

interface SignedTerm {
  sign: 1 | -1;
  term: FormulaTerm;
}

const fieldMap = (manifest: PluginManifest): Map<string, PluginField> =>
  new Map(manifest.fields.map((field) => [field.id, field]));

const TOKEN = /\s*([+-]|[a-z0-9_:]+)/y;

/** formula を [(符号, 項)] に解釈する。許される項以外が来たら例外で止める */
export const parseFormula = (manifest: PluginManifest): SignedTerm[] => {
  const fields = fieldMap(manifest);
  const pluginId = manifest.id;

  const numberField = (name: string, term: string): string => {
    const field = fields.get(name);
    if (field === undefined || field.type !== 'number') {
      throw new Error(
        `${pluginId}: progress.formula の項 ${term} が number フィールドを指していません: ${name}`,
      );
    }
    return name;
  };

  const parseTerm = (token: string): FormulaTerm => {
    if (token === 'count') return { op: 'count' };
    const parts = token.split(':');
    if (parts[0] === 'sum_if') {
      if (parts.length !== 4) {
        throw new Error(`${pluginId}: progress.formula の項が不正です: ${token}`);
      }
      const choice = fields.get(parts[1]);
      if (choice === undefined || choice.type !== 'choice' || choice.options === undefined) {
        throw new Error(
          `${pluginId}: progress.formula の項 ${token} が choice フィールドを指していません`,
        );
      }
      if (!choice.options.some((option) => option.value === parts[2])) {
        throw new Error(`${pluginId}: progress.formula の項 ${token} の選択肢がありません: ${parts[2]}`);
      }
      return { op: 'sum_if', choice: parts[1], option: parts[2], field: numberField(parts[3], token) };
    }
    if ((parts[0] === 'sum' || parts[0] === 'latest' || parts[0] === 'delta') && parts.length === 2) {
      return { op: parts[0], field: numberField(parts[1], token) };
    }
    throw new Error(`${pluginId}: progress.formula を解釈できません: ${token}`);
  };

  const text = manifest.progress.formula.trim();
  if (text === '') throw new Error(`${pluginId}: progress.formula が空です`);
  const terms: SignedTerm[] = [];
  let sign: 1 | -1 = 1;
  let expectTerm = true;
  let pos = 0;
  while (pos < text.length) {
    TOKEN.lastIndex = pos;
    const matched = TOKEN.exec(text);
    if (matched === null) {
      throw new Error(`${pluginId}: progress.formula を解釈できません: ${text.slice(pos)}`);
    }
    const token = matched[1];
    pos = TOKEN.lastIndex;
    if (token === '+' || token === '-') {
      if (expectTerm) {
        throw new Error(`${pluginId}: progress.formula の演算子の並びが不正です: ${text}`);
      }
      sign = token === '+' ? 1 : -1;
      expectTerm = true;
      continue;
    }
    if (!expectTerm) {
      throw new Error(`${pluginId}: progress.formula の項の間に演算子がありません: ${text}`);
    }
    terms.push({ sign, term: parseTerm(token) });
    sign = 1;
    expectTerm = false;
  }
  if (expectTerm) throw new Error(`${pluginId}: progress.formula が項で終わっていません: ${text}`);
  return terms;
};

const numberValue = (entry: PluginEntry, field: string): number => {
  const value = entry.values[field];
  if (typeof value !== 'number') {
    throw new Error(`記帳 ${entry.id} の ${field} が数値ではありません: ${JSON.stringify(value)}`);
  }
  return value;
};

/** その月の記帳（日付順。同日中は保存順） */
export const monthEntries = (entries: PluginEntry[], yearMonth: string): PluginEntry[] => {
  const prefix = `${yearMonth}-`;
  return entries
    .filter((entry) => entry.date.startsWith(prefix))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
};

export const periodProgress = (
  manifest: PluginManifest,
  entries: PluginEntry[],
  yearMonth: string,
): number => {
  const terms = parseFormula(manifest);
  const month = monthEntries(entries, yearMonth);
  let total = 0;
  for (const { sign, term } of terms) {
    let value = 0;
    if (term.op === 'count') {
      value = month.length;
    } else if (term.op === 'sum') {
      for (const entry of month) value += numberValue(entry, term.field);
    } else if (term.op === 'sum_if') {
      for (const entry of month) {
        if (entry.values[term.choice] === term.option) value += numberValue(entry, term.field);
      }
    } else if (term.op === 'latest') {
      value = month.length > 0 ? numberValue(month[month.length - 1], term.field) : 0;
    } else {
      value =
        month.length > 0
          ? numberValue(month[month.length - 1], term.field) - numberValue(month[0], term.field)
          : 0;
    }
    total += sign * value;
  }
  return total;
};

export const periodGoal = (
  manifest: PluginManifest,
  goals: PluginGoals,
  yearMonth: string,
): number | null => {
  const spec = manifest.progress.goal;
  if (spec === 'per_period') {
    const value = goals[yearMonth];
    return value === undefined ? null : value;
  }
  return spec.fixed;
};

/** 目標があり、compare の向きで進捗が届いていれば達成 */
export const isAchieved = (
  manifest: PluginManifest,
  progress: number,
  goal: number | null,
): boolean => {
  if (goal === null) return false;
  return manifest.progress.compare === 'gte' ? progress >= goal : progress <= goal;
};

export const formatProgressValue = (manifest: PluginManifest, value: number): string =>
  `${value.toLocaleString('ja-JP')}${manifest.progress.unit ?? ''}`;

export const formatFieldValue = (field: PluginField, value: PluginValue): string => {
  if (field.type === 'choice') {
    const option = field.options?.find((item) => item.value === value);
    if (option === undefined) {
      throw new Error(`フィールド ${field.id} の選択肢がありません: ${JSON.stringify(value)}`);
    }
    return option.label;
  }
  if (field.type === 'number') {
    if (typeof value !== 'number') {
      throw new Error(`フィールド ${field.id} が数値ではありません: ${JSON.stringify(value)}`);
    }
    return `${value.toLocaleString('ja-JP')}${field.unit ?? ''}`;
  }
  if (field.type === 'tags') {
    if (!Array.isArray(value)) {
      throw new Error(`フィールド ${field.id} が配列ではありません: ${JSON.stringify(value)}`);
    }
    return value.join(' / ');
  }
  return String(value);
};

/** 記帳 1 件の振り返り用ラベル（最初の memo テキスト。無ければ空文字） */
export const memoSummary = (manifest: PluginManifest, entry: PluginEntry): string => {
  for (const field of manifest.fields) {
    if (field.role !== 'memo') continue;
    if (field.type !== 'text' && field.type !== 'longtext') continue;
    const value = entry.values[field.id];
    if (typeof value === 'string' && value !== '') return value;
  }
  return '';
};
