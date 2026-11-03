/**
 * 固定データ（デモ用）：2025・2026・2027 年の 3 年分の家計簿。メンバーごとに記帳と月目標を持つ。
 * 年ごとにシード固定で毎回同じ。繁忙月の 12 月・3 月は貯金達成、旅行月や結婚式月は未達にして、
 * 黄金郷の島と普通の島が一年の地図で並ぶようにする。
 * server/seed.py の build_sample と同じ出力（サーバーは今日より後の記帳を DB に入れない）。
 */
import { daysInMonth, toDateKey } from '../lib/calendar';
import { toYearMonth } from '../lib/ledger';
import type { GoalsByMember, LedgerEntry, LedgerKind } from '../types/ledger';
import { SAMPLE_MEMBERS, SAMPLE_YEARS } from './sampleEvents';

const EXPENSE_TITLES = [
  '食費',
  '光熱費',
  '交通',
  '日用品',
  '交際',
  '趣味',
  'サブスク',
  '買い物',
  '医療',
  '通信費',
];

/** 収入に対する支出の割合。1 を超える月は赤字で目標未達 */
const SPEND_RATIO: Record<number, number> = {
  1: 0.72,
  2: 0.95,
  3: 0.7,
  4: 0.75,
  5: 0.98,
  6: 1.05,
  7: 0.78,
  8: 1.12,
  9: 0.96,
  10: 1.08,
  11: 0.74,
  12: 0.65,
};

/** メンバーごとの給与と冬の賞与。SAMPLE_MEMBERS と同じ順に乱数を使う */
const SAMPLE_INCOME: { member: string; salary: number; bonus: number }[] = [
  { member: SAMPLE_MEMBERS[0], salary: 220_000, bonus: 150_000 },
  { member: SAMPLE_MEMBERS[1], salary: 210_000, bonus: 120_000 },
];
/** 家賃 85,000 円をふたりで半分ずつ。各自の記帳にする */
const RENT_SHARE = 42_500;
/** メンバーごとの月の貯金目標 */
const GOAL = 30_000;

/** 年ごとの乱数シード。2026 年は 20261014 */
export const sampleLedgerSeed = (year: number): number => 20261014 + (year - 2026) * 10000;

const mulberry32 = (seed: number) => (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)];

const buildSampleLedgerForYear = (
  year: number,
  entries: LedgerEntry[],
  goals: GoalsByMember,
): void => {
  const rng = mulberry32(sampleLedgerSeed(year));
  let seq = 0;
  const push = (date: string, kind: LedgerKind, amount: number, title: string, member: string) => {
    entries.push({
      id: `ledger-sample-${year}-${seq++}`,
      date,
      kind,
      amount,
      title,
      owners: [member],
    });
  };

  for (let month = 1; month <= 12; month++) {
    const days = daysInMonth(year, month);
    for (const { member, salary, bonus } of SAMPLE_INCOME) {
      goals[member][toYearMonth(year, month)] = GOAL;
      let income = salary;
      push(toDateKey(year, month, Math.min(25, days)), 'income', salary, '給与', member);
      if (month === 12) {
        push(toDateKey(year, 12, 10), 'income', bonus, '冬の賞与', member);
        income += bonus;
      }

      const targetSpend = Math.round((income * SPEND_RATIO[month]) / 100) * 100;
      push(toDateKey(year, month, 1), 'expense', RENT_SHARE, '家賃', member);

      const remaining = targetSpend - RENT_SHARE;
      const n = 10;
      const weights = Array.from({ length: n }, () => 0.45 + rng());
      const sumW = weights.reduce((a, b) => a + b, 0);
      let allocated = 0;
      for (let i = 0; i < n; i++) {
        const raw =
          i === n - 1
            ? remaining - allocated
            : Math.round(((remaining * weights[i]) / sumW) / 100) * 100;
        const amount = Math.max(500, raw);
        allocated += amount;
        const day = 2 + Math.floor(rng() * (days - 1));
        push(toDateKey(year, month, day), 'expense', amount, pick(rng, EXPENSE_TITLES), member);
      }
    }
  }
};

const buildSampleLedger = (): { entries: LedgerEntry[]; goals: GoalsByMember } => {
  const entries: LedgerEntry[] = [];
  const goals: GoalsByMember = {};
  for (const member of SAMPLE_MEMBERS) goals[member] = {};
  for (const year of SAMPLE_YEARS) {
    buildSampleLedgerForYear(year, entries, goals);
  }
  return { entries, goals };
};

const SAMPLE = buildSampleLedger();
export const sampleLedger: LedgerEntry[] = SAMPLE.entries;
export const sampleGoals: GoalsByMember = SAMPLE.goals;
