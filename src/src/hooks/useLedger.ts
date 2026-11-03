import { useEffect, useRef, useState } from 'react';
import {
  createLedgerEntry,
  deleteLedgerEntry,
  fetchLedger,
  putMonthlyGoal,
  type LedgerSnapshot,
} from '../lib/ledgerApi';
import type { GoalsByMember, LedgerEntry, LedgerKind } from '../types/ledger';

export interface NewLedgerInput {
  date: string;
  kind: LedgerKind;
  amount: number;
  title: string;
}

export interface LedgerStore {
  /** 全員の記帳。メンバー別は lib/ledger の entriesOf で絞る */
  entries: LedgerEntry[];
  /** メンバー別の月目標。メンバー別は lib/ledger の goalsOf で取り出す */
  goals: GoalsByMember;
  /** 初回読み込みが成功するまで false */
  ready: boolean;
  /** 読み込みに失敗したときのメッセージ。成功時は null */
  error: string | null;
  addEntry: (input: NewLedgerInput) => Promise<void>;
  removeEntry: (entryId: string) => Promise<void>;
  /** ログイン中のメンバー（currentUser）の目標を書く */
  setMonthlyGoal: (year: number, month: number, amount: number) => Promise<void>;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const POLL_MS = 2000;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * 同じサーバーを開いたブラウザで共有する家計簿。
 * 記帳と、メンバーごと・月ごとの貯金目標は /api/ledger と /api/goals。
 * 2 秒ごとに読み直し、内容が変わったときだけ画面を更新する。
 * currentUser は記帳者・削除者・目標を持つ人として使う。null のときに書き込むと Error。
 */
export const useLedger = (currentUser: string | null): LedgerStore => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [goals, setGoals] = useState<GoalsByMember>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const ledgerJson = useRef('');
  const userRef = useRef<string | null>(currentUser);

  useEffect(() => {
    userRef.current = currentUser;
  }, [currentUser]);

  const applyLedger = (snapshot: LedgerSnapshot) => {
    const next = JSON.stringify(snapshot);
    if (next === ledgerJson.current) return;
    ledgerJson.current = next;
    setEntries(snapshot.entries);
    setGoals(snapshot.goals);
  };

  const refresh = async (seen: number) => {
    const snapshot = await fetchLedger();
    if (!alive.current || revision.current !== seen) return;
    applyLedger(snapshot);
    setError(null);
    setReady(true);
  };

  useEffect(() => {
    alive.current = true;
    let active = true;
    let timer = 0;
    const tick = () => {
      const seen = revision.current;
      refresh(seen).catch((err: unknown) => {
        if (!active || revision.current !== seen) return;
        console.error(err);
        window.clearInterval(timer);
        setError(errorMessage(err));
      });
    };
    tick();
    timer = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      alive.current = false;
      window.clearInterval(timer);
    };
  }, []);

  const afterWrite = async (run: () => Promise<void>): Promise<void> => {
    revision.current += 1;
    await run();
    revision.current += 1;
    await refresh(revision.current);
  };

  const requireReady = (action: string): void => {
    if (ready) return;
    if (error !== null) throw new Error(error);
    throw new Error(`${action}: 家計簿の読み込みが終わっていません`);
  };

  const addEntry = ({ date, kind, amount, title }: NewLedgerInput): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('addEntry: ログインしていません');
    }
    requireReady('addEntry');
    if (!DATE_KEY.test(date)) {
      throw new Error(`addEntry: 日付の形式が不正です: ${date}`);
    }
    if (kind !== 'income' && kind !== 'expense') {
      throw new Error(`addEntry: 収支の種類が不正です: ${String(kind)}`);
    }
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error(`addEntry: 金額は 1 円以上の整数にしてください: ${amount}`);
    }
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new Error('addEntry: タイトルが空です');
    }
    return afterWrite(async () => {
      await createLedgerEntry({ date, kind, amount, title: trimmed, owner: user });
    });
  };

  const removeEntry = (entryId: string): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('removeEntry: ログインしていません');
    }
    requireReady('removeEntry');
    return afterWrite(async () => {
      await deleteLedgerEntry(entryId, user);
    });
  };

  const setMonthlyGoal = (year: number, month: number, amount: number): Promise<void> => {
    const user = userRef.current;
    if (user === null) {
      throw new Error('setMonthlyGoal: ログインしていません');
    }
    requireReady('setMonthlyGoal');
    if (month < 1 || month > 12) {
      throw new Error(`setMonthlyGoal: 月が不正です: ${month}`);
    }
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error(`setMonthlyGoal: 目標は 1 円以上の整数にしてください: ${amount}`);
    }
    return afterWrite(async () => {
      await putMonthlyGoal({ owner: user, year, month, amount });
    });
  };

  return {
    entries,
    goals,
    ready,
    error,
    addEntry,
    removeEntry,
    setMonthlyGoal,
  };
};
