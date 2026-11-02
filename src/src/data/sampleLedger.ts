/**
 * 固定データ（デモ用）：2026 年 1 年分の家計簿。
 * シード固定で毎回同じ。繁忙月の 12 月・3 月は貯金達成、旅行月や結婚式月は未達にして、
 * 黄金郷の島と普通の島が一年の地図で並ぶようにする。
 */
import { daysInMonth, toDateKey } from '../lib/calendar';
import { toYearMonth } from '../lib/ledger';
import type { LedgerEntry, LedgerKind, MonthlyGoals } from '../types/ledger';
import { SAMPLE_MEMBERS, SAMPLE_YEAR } from './sampleEvents';

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

const SALARY_TARO = 220_000;
const SALARY_HANA = 210_000;
const RENT = 85_000;
const BONUS_TARO = 150_000;
const BONUS_HANA = 120_000;
const GOAL = 50_000;

const mulberry32 = (seed: number) => (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)];

const pushEntry = (
  entries: LedgerEntry[],
  id: { n: number },
  date: string,
  kind: LedgerKind,
  amount: number,
  title: string,
  owners: string[],
) => {
  entries.push({
    id: `ledger-sample-${id.n++}`,
    date,
    kind,
    amount,
    title,
    owners,
  });
};

const buildSampleLedger = (): { entries: LedgerEntry[]; goals: MonthlyGoals } => {
  const rng = mulberry32(20261014);
  const entries: LedgerEntry[] = [];
  const goals: MonthlyGoals = {};
  const id = { n: 0 };

  for (let month = 1; month <= 12; month++) {
    goals[toYearMonth(SAMPLE_YEAR, month)] = GOAL;
    const days = daysInMonth(SAMPLE_YEAR, month);
    let income = 0;

    pushEntry(
      entries,
      id,
      toDateKey(SAMPLE_YEAR, month, Math.min(25, days)),
      'income',
      SALARY_TARO,
      '給与',
      [SAMPLE_MEMBERS[0]],
    );
    income += SALARY_TARO;
    pushEntry(
      entries,
      id,
      toDateKey(SAMPLE_YEAR, month, Math.min(25, days)),
      'income',
      SALARY_HANA,
      '給与',
      [SAMPLE_MEMBERS[1]],
    );
    income += SALARY_HANA;

    if (month === 12) {
      pushEntry(
        entries,
        id,
        toDateKey(SAMPLE_YEAR, 12, 10),
        'income',
        BONUS_TARO,
        '冬の賞与',
        [SAMPLE_MEMBERS[0]],
      );
      income += BONUS_TARO;
      pushEntry(
        entries,
        id,
        toDateKey(SAMPLE_YEAR, 12, 10),
        'income',
        BONUS_HANA,
        '冬の賞与',
        [SAMPLE_MEMBERS[1]],
      );
      income += BONUS_HANA;
    }

    const targetSpend = Math.round((income * SPEND_RATIO[month]) / 100) * 100;
    pushEntry(
      entries,
      id,
      toDateKey(SAMPLE_YEAR, month, 1),
      'expense',
      RENT,
      '家賃',
      [...SAMPLE_MEMBERS],
    );

    const remaining = targetSpend - RENT;
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
      pushEntry(
        entries,
        id,
        toDateKey(SAMPLE_YEAR, month, day),
        'expense',
        amount,
        pick(rng, EXPENSE_TITLES),
        [pick(rng, SAMPLE_MEMBERS)],
      );
    }
  }

  return { entries, goals };
};

const SAMPLE = buildSampleLedger();
export const sampleLedger: LedgerEntry[] = SAMPLE.entries;
export const sampleGoals: MonthlyGoals = SAMPLE.goals;
