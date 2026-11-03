import type { GoalsByMember, LedgerEntry, LedgerKind, MonthlyGoals } from '../types/ledger';

export interface LedgerSnapshot {
  entries: LedgerEntry[];
  /** メンバー名 → 'YYYY-MM' → 目標（円） */
  goals: GoalsByMember;
}

export interface NewLedgerRequest {
  date: string;
  kind: LedgerKind;
  amount: number;
  title: string;
  /** 記帳したメンバー名。サーバーは 1 人 */
  owner: string;
}

export interface MonthlyGoalRequest {
  /** 目標を持つメンバー名。サーバーに登録済みであること */
  owner: string;
  year: number;
  month: number;
  amount: number;
}

export interface MonthlyGoalResult {
  owner: string;
  /** 'YYYY-MM' */
  yearMonth: string;
  amount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failureMessage = (body: unknown, status: number): string => {
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  throw new Error(
    `ledgerApi: HTTP ${status} の失敗応答に error 文字列がありません: ${JSON.stringify(body)}`,
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

const asLedgerEntry = (body: unknown): LedgerEntry => {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.date !== 'string' ||
    (body.kind !== 'income' && body.kind !== 'expense') ||
    typeof body.amount !== 'number' ||
    typeof body.title !== 'string' ||
    !Array.isArray(body.owners)
  ) {
    throw new Error(`ledgerApi: 記帳の応答形式が不正です: ${JSON.stringify(body)}`);
  }
  const owners = body.owners.map((owner) => {
    if (typeof owner !== 'string') {
      throw new Error(`ledgerApi: 記帳者の形式が不正です: ${JSON.stringify(body.owners)}`);
    }
    return owner;
  });
  return {
    id: body.id,
    date: body.date,
    kind: body.kind,
    amount: body.amount,
    title: body.title,
    owners,
  };
};

const asMonthlyGoals = (member: string, body: unknown): MonthlyGoals => {
  if (!isRecord(body)) {
    throw new Error(`ledgerApi: ${member} の目標がオブジェクトではありません: ${JSON.stringify(body)}`);
  }
  return Object.fromEntries(
    Object.entries(body).map(([yearMonth, value]) => {
      if (typeof value !== 'number') {
        throw new Error(
          `ledgerApi: 目標が数値ではありません: ${member} ${yearMonth}=${JSON.stringify(value)}`,
        );
      }
      return [yearMonth, value];
    }),
  );
};

export const asLedgerSnapshot = (body: unknown): LedgerSnapshot => {
  if (!isRecord(body) || !Array.isArray(body.entries) || !isRecord(body.goals)) {
    throw new Error(`ledgerApi: 家計の応答形式が不正です: ${JSON.stringify(body)}`);
  }
  const goals: GoalsByMember = Object.fromEntries(
    Object.entries(body.goals).map(([member, value]) => [member, asMonthlyGoals(member, value)]),
  );
  return { entries: body.entries.map((entry) => asLedgerEntry(entry)), goals };
};

const asMonthlyGoalResult = (body: unknown): MonthlyGoalResult => {
  if (
    !isRecord(body) ||
    typeof body.owner !== 'string' ||
    typeof body.yearMonth !== 'string' ||
    typeof body.amount !== 'number'
  ) {
    throw new Error(`ledgerApi: 目標の応答形式が不正です: ${JSON.stringify(body)}`);
  }
  return { owner: body.owner, yearMonth: body.yearMonth, amount: body.amount };
};

export const fetchLedger = async (): Promise<LedgerSnapshot> =>
  asLedgerSnapshot(await request('/api/ledger'));

export const createLedgerEntry = async (body: NewLedgerRequest): Promise<LedgerEntry> =>
  asLedgerEntry(await request('/api/ledger', jsonInit('POST', body)));

export const deleteLedgerEntry = async (id: string, user: string): Promise<void> => {
  await request(`/api/ledger/${id}?user=${encodeURIComponent(user)}`, { method: 'DELETE' });
};

export const putMonthlyGoal = async (body: MonthlyGoalRequest): Promise<MonthlyGoalResult> =>
  asMonthlyGoalResult(await request('/api/goals', jsonInit('PUT', body)));

export const resetLedger = async (): Promise<LedgerSnapshot> =>
  asLedgerSnapshot(await request('/api/ledger/reset', { method: 'POST' }));
