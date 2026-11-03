import { type FormEvent, useState } from 'react';
import { daysInMonth } from '../../lib/calendar';
import { formatYen, toYearMonth, type MonthLedger } from '../../lib/ledger';
import type { LedgerKind } from '../../types/ledger';
import './LedgerScreen.css';

export interface LedgerScreenProps {
  year: number;
  month: number;
  currentUser: string;
  /** lib/ledger.ts の monthLedger() の戻り */
  ledger: MonthLedger;
  goal: number | null;
  achieved: boolean;
  onAdd: (day: number, kind: LedgerKind, amount: number, title: string) => Promise<void>;
  onRemove: (entryId: string) => Promise<void>;
  onSetGoal: (amount: number) => Promise<void>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** 「✕ 閉じる」で呼ぶ。親が家計簿を閉じて元の表示に戻す */
  onClose: () => void;
}

const KIND_LABEL: Record<LedgerKind, string> = {
  income: '収入',
  expense: '支出',
};

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const wrapMonth = (month: number, delta: number): number => ((month - 1 + delta + 12) % 12) + 1;

/** 管理機能「家計簿」。下部バーで開く独立した表示で、月送りを持つ */
export const LedgerScreen = ({
  year,
  month,
  currentUser,
  ledger,
  goal,
  achieved,
  onAdd,
  onRemove,
  onSetGoal,
  onPrevMonth,
  onNextMonth,
  onClose,
}: LedgerScreenProps) => {
  const days = daysInMonth(year, month);
  const monthKey = toYearMonth(year, month);
  const [shownMonth, setShownMonth] = useState(monthKey);
  const [kind, setKind] = useState<LedgerKind>('expense');
  const [day, setDay] = useState(String(Math.min(25, days)));
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [goalInput, setGoalInput] = useState(goal === null ? '' : String(goal));
  const [entryError, setEntryError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // 月送りで表示月が変わったら、入力欄をその月の値に合わせる
  if (shownMonth !== monthKey) {
    setShownMonth(monthKey);
    setDay(String(Math.min(25, days)));
    setGoalInput(goal === null ? '' : String(goal));
    setEntryError(null);
    setGoalError(null);
    setRemoveError(null);
  }

  const remain = goal === null ? 0 : goal - ledger.savings;
  const ratio = goal === null ? 0 : Math.min(1, Math.max(0, ledger.savings / goal));
  const filledCoins = Math.round(ratio * 10);

  const submitEntry = async (e: FormEvent) => {
    e.preventDefault();
    const dayN = Number(day);
    const amountN = Number(amount);
    const trimmed = title.trim();
    try {
      if (!Number.isInteger(dayN) || dayN < 1 || dayN > days) {
        throw new Error(`LedgerScreen: 日が不正です: ${day}`);
      }
      if (!Number.isInteger(amountN) || amountN < 1) {
        throw new Error(`LedgerScreen: 金額は 1 円以上の整数にしてください: ${amount}`);
      }
      if (trimmed.length === 0) {
        throw new Error('LedgerScreen: タイトルが空です');
      }
      await onAdd(dayN, kind, amountN, trimmed);
      setAmount('');
      setTitle('');
      setEntryError(null);
    } catch (err) {
      console.error(err);
      setEntryError(errorMessage(err));
    }
  };

  const submitGoal = async (e: FormEvent) => {
    e.preventDefault();
    const amountN = Number(goalInput);
    try {
      if (!Number.isInteger(amountN) || amountN < 1) {
        throw new Error(`LedgerScreen: 目標は 1 円以上の整数にしてください: ${goalInput}`);
      }
      await onSetGoal(amountN);
      setGoalError(null);
    } catch (err) {
      console.error(err);
      setGoalError(errorMessage(err));
    }
  };

  const removeEntry = async (entryId: string) => {
    try {
      await onRemove(entryId);
      setRemoveError(null);
    } catch (err) {
      console.error(err);
      setRemoveError(errorMessage(err));
    }
  };

  return (
    <aside className="ledger-panel panel" aria-label={`${year}年${month}月の家計簿`}>
      <header className="ledger-head">
        <div>
          <div className="ledger-kicker">{year}年{month}月</div>
          <h2 className="ledger-title">家計簿</h2>
        </div>
        <div className="ledger-month-nav">
          <button
            type="button"
            className="btn btn-small"
            aria-label={`${wrapMonth(month, -1)}月へ`}
            title={`${wrapMonth(month, -1)}月へ`}
            onClick={onPrevMonth}
          >
            ◀
          </button>
          <button
            type="button"
            className="btn btn-small"
            aria-label={`${wrapMonth(month, 1)}月へ`}
            title={`${wrapMonth(month, 1)}月へ`}
            onClick={onNextMonth}
          >
            ▶
          </button>
          <button
            type="button"
            className="btn btn-small ledger-close"
            aria-label="家計簿を閉じる"
            onClick={onClose}
          >
            ✕ 閉じる
          </button>
        </div>
      </header>

      <dl className="ledger-sums">
        <div>
          <dt>収入</dt>
          <dd>{formatYen(ledger.income)}</dd>
        </div>
        <div>
          <dt>支出</dt>
          <dd>{formatYen(ledger.expense)}</dd>
        </div>
        <div>
          <dt>貯金</dt>
          <dd className={achieved ? 'is-gold' : undefined}>{formatYen(ledger.savings)}</dd>
        </div>
      </dl>

      {goal === null ? (
        <p className="ledger-status">この月の貯金目標を書いてください。</p>
      ) : (
        <>
          <p className="ledger-goal-line">
            目標 {formatYen(goal)}
            {remain <= 0 ? ' · 達成' : ` · あと ${formatYen(remain)}`}
          </p>
          <div className="ledger-coins" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < filledCoins ? 'is-filled' : undefined} />
            ))}
          </div>
          {achieved ? (
            <p className="ledger-status is-gold">この月の島は黄金郷になった。</p>
          ) : (
            <p className="ledger-status">目標に届くと、この月の島が黄金郷になる。</p>
          )}
        </>
      )}

      <form className="ledger-goal-form" onSubmit={submitGoal}>
        <label className="login-label" htmlFor="ledger-goal">
          貯金目標（円）
        </label>
        <div className="login-row">
          <input
            id="ledger-goal"
            className="input"
            inputMode="numeric"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
          />
          <button type="submit" className="btn btn-small">
            目標にする
          </button>
        </div>
        {goalError !== null ? (
          <p className="ledger-status" role="alert">
            {goalError}
          </p>
        ) : null}
      </form>

      <form className="ledger-entry-form" onSubmit={submitEntry}>
        <div className="ledger-kinds" role="radiogroup" aria-label="収支">
          {(['income', 'expense'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              className={kind === value ? 'category-btn is-selected' : 'category-btn'}
              onClick={() => setKind(value)}
            >
              {KIND_LABEL[value]}
            </button>
          ))}
        </div>
        <div className="ledger-entry-grid">
          <label>
            日
            <input
              className="input"
              inputMode="numeric"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>
            金額
            <input
              className="input"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="円"
            />
          </label>
        </div>
        <label>
          内容
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'income' ? '給与' : '食費'}
          />
        </label>
        <button type="submit" className="btn btn-small">
          {KIND_LABEL[kind]}を記す
        </button>
        {entryError !== null ? (
          <p className="ledger-status" role="alert">
            {entryError}
          </p>
        ) : null}
      </form>

      {removeError !== null ? (
        <p className="ledger-status" role="alert">
          {removeError}
        </p>
      ) : null}
      {ledger.entries.length === 0 ? (
        <p className="ledger-empty">この月の記帳はまだありません。</p>
      ) : (
        <ol className="ledger-list">
          {ledger.entries.map((entry) => {
            const dayN = Number(entry.date.slice(8, 10));
            const mine = entry.owners.includes(currentUser);
            const sign = entry.kind === 'income' ? '+' : '−';
            return (
              <li key={entry.id}>
                <span className="ledger-list-day">{dayN}日</span>
                <span className="ledger-list-title">{entry.title}</span>
                <span className={entry.kind === 'income' ? 'ledger-list-in' : 'ledger-list-out'}>
                  {sign}
                  {formatYen(entry.amount)}
                </span>
                {mine ? (
                  <button type="button" className="link-btn" onClick={() => removeEntry(entry.id)}>
                    消す
                  </button>
                ) : (
                  <span className="ledger-list-owner">{entry.owners.join('・')}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
};
