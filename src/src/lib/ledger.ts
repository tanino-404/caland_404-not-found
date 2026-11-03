import type { GoalsByMember, LedgerEntry, MonthlyGoals } from '../types/ledger';

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const toYearMonth = (year: number, month: number): string =>
  `${year}-${pad2(month)}`;

/** そのメンバーの家計。owners に member を含む記帳（金額はそのまま計上） */
export const entriesOf = (entries: LedgerEntry[], member: string): LedgerEntry[] =>
  entries.filter((entry) => entry.owners.includes(member));

const NO_GOALS: MonthlyGoals = Object.freeze({});

/** そのメンバーの月目標。まだ 1 つも書いていなければ空 */
export const goalsOf = (goals: GoalsByMember, member: string): MonthlyGoals =>
  Object.hasOwn(goals, member) ? goals[member] : NO_GOALS;

export interface MonthLedger {
  entries: LedgerEntry[];
  income: number;
  expense: number;
  savings: number;
}

export const monthLedger = (
  entries: LedgerEntry[],
  year: number,
  month: number,
): MonthLedger => {
  const prefix = `${toYearMonth(year, month)}-`;
  const monthEntries: LedgerEntry[] = [];
  let income = 0;
  let expense = 0;
  for (const entry of entries) {
    if (!entry.date.startsWith(prefix)) continue;
    monthEntries.push(entry);
    if (entry.kind === 'income') income += entry.amount;
    else expense += entry.amount;
  }
  monthEntries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { entries: monthEntries, income, expense, savings: income - expense };
};

export const monthGoal = (goals: MonthlyGoals, year: number, month: number): number | null => {
  const value = goals[toYearMonth(year, month)];
  if (value === undefined) return null;
  return value;
};

/** 目標が書いてあり、貯金が目標以上ならその月の島は黄金郷 */
export const isMonthLuxurious = (savings: number, goal: number | null): boolean =>
  goal !== null && savings >= goal;

export const formatYen = (amount: number): string => `${amount.toLocaleString('ja-JP')}円`;
