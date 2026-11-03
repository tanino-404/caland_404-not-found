import { type FormEvent, useState } from 'react';
import { daysInMonth } from '../../lib/calendar';
import {
  formatFieldValue,
  formatProgressValue,
  memoSummary,
  monthEntries,
  toYearMonth,
} from '../../lib/plugins';
import type { PluginData, PluginEntryValues, PluginField } from '../../types/plugins';

export interface PluginHudProps {
  year: number;
  month: number;
  currentUser: string;
  data: PluginData;
  /** この月の進捗（式の値） */
  progress: number;
  /** この月の目標。無ければ null（未達成扱い） */
  goal: number | null;
  achieved: boolean;
  /** manifest.effect が部品表に無いときの文。無ければ null */
  effectMismatch: string | null;
  /** プラグインの読み込みに失敗したときの文。無ければ null */
  loadError: string | null;
  onAdd: (date: string, values: PluginEntryValues) => Promise<void> | void;
  onRemove: (entryId: string) => void;
  /** 月ごとの目標のときだけ。固定目標なら null */
  onSetGoal: ((amount: number) => void) | null;
  onClose: () => void;
}

/** マニフェストのフィールドから入力欄と検証を生成する汎用パネル */
export const PluginHud = ({
  year,
  month,
  currentUser,
  data,
  progress,
  goal,
  achieved,
  effectMismatch,
  loadError,
  onAdd,
  onRemove,
  onSetGoal,
  onClose,
}: PluginHudProps) => {
  const { manifest } = data;
  const days = daysInMonth(year, month);
  const [day, setDay] = useState(String(Math.min(25, days)));
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of manifest.fields) {
      initial[field.id] = field.type === 'choice' ? (field.options?.[0]?.value ?? '') : '';
    }
    return initial;
  });
  const [goalInput, setGoalInput] = useState(goal === null ? '' : String(goal));
  const [entryError, setEntryError] = useState<string | null>(null);

  const entries = monthEntries(data.entries, toYearMonth(year, month));
  const compare = manifest.progress.compare;
  const remain = goal === null ? 0 : goal - progress;
  const ratio =
    goal === null || compare !== 'gte' || goal <= 0
      ? null
      : Math.min(1, Math.max(0, progress / goal));
  const filledCoins = ratio === null ? 0 : Math.round(ratio * 10);
  const achievedLabel = manifest.achievedLabel;
  const progressFields = manifest.fields.filter((field) => field.role === 'progress');

  const setInput = (fieldId: string, value: string) => {
    setInputs((current) => ({ ...current, [fieldId]: value }));
  };

  const parseField = (field: PluginField, raw: string): PluginEntryValues[string] => {
    if (field.type === 'number') {
      const value = Number(raw);
      if (raw.trim() === '' || Number.isNaN(value)) {
        throw new Error(`PluginHud: ${field.label} は数値にしてください: ${raw}`);
      }
      if (field.integer === true && !Number.isInteger(value)) {
        throw new Error(`PluginHud: ${field.label} は整数にしてください: ${raw}`);
      }
      if (field.min !== undefined && value < field.min) {
        throw new Error(`PluginHud: ${field.label} は ${field.min} 以上にしてください: ${raw}`);
      }
      return value;
    }
    if (field.type === 'choice') {
      if (!field.options?.some((option) => option.value === raw)) {
        throw new Error(`PluginHud: ${field.label} を選んでください`);
      }
      return raw;
    }
    if (field.type === 'tags') {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    }
    const text = raw.trim();
    if (field.type === 'text' && text === '') {
      throw new Error(`PluginHud: ${field.label} が空です`);
    }
    return text;
  };

  const submitEntry = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const dayN = Number(day);
      if (!Number.isInteger(dayN) || dayN < 1 || dayN > days) {
        throw new Error(`PluginHud: 日が不正です: ${day}`);
      }
      const values: PluginEntryValues = {};
      for (const field of manifest.fields) {
        values[field.id] = parseField(field, inputs[field.id] ?? '');
      }
      const date = `${toYearMonth(year, month)}-${String(dayN).padStart(2, '0')}`;
      await onAdd(date, values);
      setInputs((current) => {
        const next = { ...current };
        for (const field of manifest.fields) {
          if (field.type !== 'choice') next[field.id] = '';
        }
        return next;
      });
      setEntryError(null);
    } catch (err) {
      console.error(err);
      setEntryError(err instanceof Error ? err.message : String(err));
    }
  };

  const submitGoal = (e: FormEvent) => {
    e.preventDefault();
    if (onSetGoal === null) {
      throw new Error('PluginHud: このプラグインの目標は固定値です');
    }
    const amountN = Number(goalInput);
    if (!Number.isInteger(amountN) || amountN < 1) {
      throw new Error(`PluginHud: 目標は 1 以上の整数にしてください: ${goalInput}`);
    }
    onSetGoal(amountN);
  };

  const renderInput = (field: PluginField) => {
    const inputId = `plugin-${manifest.id}-${field.id}`;
    if (field.type === 'choice') {
      return (
        <div
          key={field.id}
          className="ledger-kinds"
          role="radiogroup"
          aria-label={field.label}
        >
          {(field.options ?? []).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={inputs[field.id] === option.value}
              className={
                inputs[field.id] === option.value ? 'category-btn is-selected' : 'category-btn'
              }
              onClick={() => setInput(field.id, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }
    if (field.type === 'longtext') {
      return (
        <label key={field.id} htmlFor={inputId}>
          {field.label}
          <textarea
            id={inputId}
            className="input"
            rows={3}
            value={inputs[field.id] ?? ''}
            onChange={(e) => setInput(field.id, e.target.value)}
            placeholder={field.placeholder}
          />
        </label>
      );
    }
    return (
      <label key={field.id} htmlFor={inputId}>
        {field.label}
        {field.type === 'tags' ? '（カンマ区切り）' : ''}
        <input
          id={inputId}
          className="input"
          inputMode={field.type === 'number' ? 'numeric' : undefined}
          value={inputs[field.id] ?? ''}
          onChange={(e) => setInput(field.id, e.target.value)}
          placeholder={field.placeholder ?? field.unit}
        />
      </label>
    );
  };

  return (
    <aside className="ledger-panel panel" aria-label={`${year}年${month}月の${manifest.title}`}>
      <header className="ledger-head">
        <div>
          <div className="ledger-kicker">
            {year}年{month}月
          </div>
          <h2 className="ledger-title">{manifest.title}</h2>
        </div>
        <button type="button" className="link-btn" onClick={onClose}>
          閉じる
        </button>
      </header>

      {loadError !== null ? (
        <p className="ledger-status" role="alert">
          {loadError}
        </p>
      ) : null}
      {effectMismatch !== null ? (
        <p className="ledger-status" role="alert">
          {effectMismatch}
        </p>
      ) : null}

      <dl className="ledger-sums">
        <div>
          <dt>{manifest.progress.label}</dt>
          <dd className={achieved ? 'is-gold' : undefined}>
            {formatProgressValue(manifest, progress)}
          </dd>
        </div>
        <div>
          <dt>記帳</dt>
          <dd>{entries.length} 件</dd>
        </div>
      </dl>

      {goal === null ? (
        <p className="ledger-status">この月の目標を書いてください。</p>
      ) : (
        <>
          <p className="ledger-goal-line">
            目標 {formatProgressValue(manifest, goal)}
            {achieved
              ? ' · 達成'
              : compare === 'gte'
                ? ` · あと ${formatProgressValue(manifest, remain)}`
                : ` · ${formatProgressValue(manifest, goal)} 以下で達成`}
          </p>
          {ratio !== null ? (
            <div className="ledger-coins" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={i < filledCoins ? 'is-filled' : undefined} />
              ))}
            </div>
          ) : null}
          {achieved ? (
            <p className="ledger-status is-gold">
              {achievedLabel !== undefined
                ? `この月の島は${achievedLabel}になった。`
                : 'この月の目標を達成した。'}
            </p>
          ) : (
            <p className="ledger-status">
              {achievedLabel !== undefined
                ? `目標に届くと、この月の島が${achievedLabel}になる。`
                : '目標に届くと、この月の島の見た目が変わる。'}
            </p>
          )}
        </>
      )}

      {onSetGoal !== null ? (
        <form className="ledger-goal-form" onSubmit={submitGoal}>
          <label className="login-label" htmlFor={`plugin-${manifest.id}-goal`}>
            月の目標{manifest.progress.unit !== undefined ? `（${manifest.progress.unit}）` : ''}
          </label>
          <div className="login-row">
            <input
              id={`plugin-${manifest.id}-goal`}
              className="input"
              inputMode="numeric"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
            />
            <button type="submit" className="btn btn-small">
              目標にする
            </button>
          </div>
        </form>
      ) : (
        <p className="ledger-status">目標は {goal === null ? 'なし' : formatProgressValue(manifest, goal)}（固定）。</p>
      )}

      <form className="ledger-entry-form" onSubmit={submitEntry}>
        <div className="ledger-entry-grid">
          <label htmlFor={`plugin-${manifest.id}-day`}>
            日
            <input
              id={`plugin-${manifest.id}-day`}
              className="input"
              inputMode="numeric"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        </div>
        {manifest.fields.map((field) => renderInput(field))}
        <button type="submit" className="btn btn-small">
          記す
        </button>
        {entryError !== null ? (
          <p className="ledger-status" role="alert">
            {entryError}
          </p>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <p className="ledger-empty">この月の記帳はまだありません。</p>
      ) : (
        <ol className="ledger-list">
          {entries.map((entry) => {
            const dayN = Number(entry.date.slice(8, 10));
            const mine = entry.owners.includes(currentUser);
            const memo = memoSummary(manifest, entry);
            const valueText = progressFields
              .map((field) => formatFieldValue(field, entry.values[field.id]))
              .join(' · ');
            return (
              <li key={entry.id}>
                <span className="ledger-list-day">{dayN}日</span>
                <span className="ledger-list-title">{memo !== '' ? memo : manifest.progress.label}</span>
                <span className="ledger-list-in">{valueText}</span>
                {mine ? (
                  <button type="button" className="link-btn" onClick={() => onRemove(entry.id)}>
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
