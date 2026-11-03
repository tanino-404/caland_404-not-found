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

/**
 * 島の見た目。effect 部品表の theme。
 * - plain：いつもの草・土・石・雪
 * - luxury：金と大理石の島（黄金郷）
 */
export type IslandTheme = 'plain' | 'luxury';
