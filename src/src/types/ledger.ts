export type LedgerKind = 'income' | 'expense';

export interface LedgerEntry {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  kind: LedgerKind;
  /** 円。1 以上の整数 */
  amount: number;
  title: string;
  /** 記帳したメンバー名（1 人以上） */
  owners: string[];
}

/** 月キー 'YYYY-MM' → その月の貯金目標（円） */
export type MonthlyGoals = Record<string, number>;

/** メンバー名 → そのメンバーの月ごとの貯金目標。目標を書いていないメンバーはキーが無い */
export type GoalsByMember = Record<string, MonthlyGoals>;

/**
 * 島の見た目。
 * - plain：いつもの草・土・石・雪
 * - luxury：その月の貯金目標を達成した黄金郷
 */
export type IslandTheme = 'plain' | 'luxury';
