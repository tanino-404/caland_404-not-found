import { type FormEvent, useState } from 'react';
import type { NewPluginGoalInput } from '../../hooks/useSharedCalendar';
import { daysInMonth, toDateKey } from '../../lib/calendar';
import { computeMetric, formatMetricValue, goalMetric, monthEndKey, monthStartKey } from '../../lib/pluginStatus';
import type {
  PluginData,
  PluginEntry,
  PluginField,
  PluginGoal,
  PluginGroup,
  PluginManifest,
  PluginStatus,
} from '../../types/plugins';

export interface PluginHudProps {
  manifest: PluginManifest;
  /** 表示中のグループ。自分がメンバーでなければ参加ボタンを出す */
  group: PluginGroup;
  onJoinGroup: () => Promise<void>;
  year: number;
  month: number;
  currentUser: string;
  /** この月の記録（日付順） */
  entries: PluginEntry[];
  /** この月に期間が重なる目標 */
  goals: PluginGoal[];
  /** 月末時点の目標と進捗 */
  status: PluginStatus;
  onAddEntry: (date: string, data: PluginData) => void | Promise<void>;
  onRemoveEntry: (entryId: string) => void;
  onAddGoal: (input: NewPluginGoalInput) => void | Promise<void>;
  onRemoveGoal: (goalId: string) => void;
  onClose: () => void;
}

const initialFieldValues = (manifest: PluginManifest): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const field of manifest.fields) {
    values[field.key] = field.type === 'select' ? (field.options ?? [])[0]?.value ?? '' : '';
  }
  return values;
};

/** 入力文字列を plugin.json の fields に沿った値へ変える。詳細な検証はサーバーが行う */
const buildData = (manifest: PluginManifest, values: Record<string, string>): PluginData => {
  const data: PluginData = {};
  for (const field of manifest.fields) {
    if (field.type === 'boolean') {
      data[field.key] = values[field.key] === 'true';
      continue;
    }
    const raw = (values[field.key] ?? '').trim();
    if (raw === '') continue;
    if (field.type === 'number' || field.type === 'integer') {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || (field.type === 'integer' && !Number.isInteger(parsed))) {
        const noun = field.type === 'integer' ? '整数' : '数値';
        throw new Error(`PluginHud: ${field.label} は${noun}にしてください: ${raw}`);
      }
      data[field.key] = parsed;
    } else if (field.type === 'tags') {
      data[field.key] = raw
        .split(/[、,]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag !== '');
    } else {
      data[field.key] = raw;
    }
  }
  return data;
};

/** 一覧に見せる値（select は表示名、数値は単位付き、タグは「・」区切り） */
const displayValue = (field: PluginField, value: PluginData[string]): string | null => {
  if (field.type === 'select') {
    const option = (field.options ?? []).find((o) => o.value === value);
    return option === undefined ? String(value) : option.label;
  }
  if (typeof value === 'number') return formatMetricValue(value, field.unit);
  if (typeof value === 'boolean') return value ? field.label : null;
  if (Array.isArray(value)) return value.join('・');
  return value;
};

const formatAverage = (value: number, unit: string | undefined): string =>
  formatMetricValue(Math.round(value * 10) / 10, unit);

export const PluginHud = ({
  manifest,
  group,
  onJoinGroup,
  year,
  month,
  currentUser,
  entries,
  goals,
  status,
  onAddEntry,
  onRemoveEntry,
  onAddGoal,
  onRemoveGoal,
  onClose,
}: PluginHudProps) => {
  const days = daysInMonth(year, month);
  const metric = goalMetric(manifest);
  const [values, setValues] = useState<Record<string, string>>(() => initialFieldValues(manifest));
  const [day, setDay] = useState(String(Math.min(25, days)));
  const [entryError, setEntryError] = useState<string | null>(null);
  const [goalLabel, setGoalLabel] = useState('');
  const [goalStart, setGoalStart] = useState(monthStartKey(year, month));
  const [goalEnd, setGoalEnd] = useState(monthEndKey(year, month));
  const [goalTarget, setGoalTarget] = useState(status.goal === null ? '' : String(status.goal.target));
  const [goalError, setGoalError] = useState<string | null>(null);

  const setValue = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const filledCoins = Math.round(status.progress * 10);

  const submitEntry = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const dayN = Number(day);
      if (!Number.isInteger(dayN) || dayN < 1 || dayN > days) {
        throw new Error(`PluginHud: 日が不正です: ${day}`);
      }
      await onAddEntry(toDateKey(year, month, dayN), buildData(manifest, values));
      setValues(initialFieldValues(manifest));
      setEntryError(null);
    } catch (err) {
      console.error(err);
      setEntryError(err instanceof Error ? err.message : String(err));
    }
  };

  const submitGoal = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const target = Number(goalTarget.trim());
      if (goalTarget.trim() === '' || !Number.isFinite(target)) {
        throw new Error(`PluginHud: 目標は数値にしてください: ${goalTarget}`);
      }
      await onAddGoal({ start: goalStart, end: goalEnd, target, label: goalLabel });
      setGoalError(null);
    } catch (err) {
      console.error(err);
      setGoalError(err instanceof Error ? err.message : String(err));
    }
  };

  const fieldInput = (field: PluginField) => {
    if (field.type === 'select') {
      return (
        <div className="ledger-kinds" role="radiogroup" aria-label={field.label}>
          {(field.options ?? []).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={values[field.key] === option.value}
              className={values[field.key] === option.value ? 'category-btn is-selected' : 'category-btn'}
              onClick={() => setValue(field.key, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }
    if (field.type === 'boolean') {
      const checked = values[field.key] === 'true';
      return (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          className={checked ? 'category-btn is-selected' : 'category-btn'}
          onClick={() => setValue(field.key, checked ? '' : 'true')}
        >
          {field.label}
        </button>
      );
    }
    const numeric = field.type === 'number' || field.type === 'integer';
    return (
      <label>
        {field.label}
        {field.unit !== undefined ? `（${field.unit}）` : ''}
        {field.required === true ? '' : '（任意）'}
        <input
          className="input"
          type={field.type === 'date' ? 'date' : 'text'}
          inputMode={numeric ? 'numeric' : undefined}
          value={values[field.key] ?? ''}
          onChange={(e) => setValue(field.key, e.target.value)}
          placeholder={field.type === 'tags' ? '読点か , で区切る' : undefined}
        />
      </label>
    );
  };

  const entryRow = (entry: PluginEntry) => {
    const dayN = Number(entry.date.slice(8, 10));
    const mine = entry.owners.includes(currentUser);
    const amount = metric.field !== undefined ? entry.data[metric.field] : undefined;
    const negate = metric.negateWhen;
    const negated =
      negate !== undefined && typeof entry.data[negate.field] === 'string'
        ? negate.values.includes(entry.data[negate.field] as string)
        : false;
    const texts = manifest.fields
      .filter((field) => field.key !== metric.field)
      .map((field) => {
        const value = entry.data[field.key];
        return value === undefined ? null : displayValue(field, value);
      })
      .filter((text): text is string => text !== null && text !== '');
    return (
      <li key={entry.id}>
        <span className="ledger-list-day">{dayN}日</span>
        <span className="ledger-list-title">{texts.join(' · ')}</span>
        {typeof amount === 'number' ? (
          negate !== undefined ? (
            <span className={negated ? 'ledger-list-out' : 'ledger-list-in'}>
              {negated ? '−' : '+'}
              {formatMetricValue(amount, metric.unit)}
            </span>
          ) : (
            <span className="ledger-list-in">{formatMetricValue(amount, metric.unit)}</span>
          )
        ) : null}
        {mine ? (
          <button type="button" className="link-btn" onClick={() => onRemoveEntry(entry.id)}>
            消す
          </button>
        ) : (
          <span className="ledger-list-owner">{entry.owners.join('・')}</span>
        )}
      </li>
    );
  };

  return (
    <aside className="ledger-panel panel" aria-label={`${year}年${month}月の${manifest.name}`}>
      <header className="ledger-head">
        <div>
          <div className="ledger-kicker">{year}年{month}月</div>
          <h2 className="ledger-title">{manifest.name}</h2>
        </div>
        <button type="button" className="link-btn" onClick={onClose}>
          閉じる
        </button>
      </header>

      <p className="ledger-status">
        グループ「{group.name}」（{group.members.join('・')}）
      </p>
      {group.members.includes(currentUser) ? null : (
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            onJoinGroup().catch((err: unknown) => {
              console.error(err);
              setEntryError(err instanceof Error ? err.message : String(err));
            });
          }}
        >
          このグループに入って記録する
        </button>
      )}

      <dl className="plugin-metrics">
        {manifest.metrics.map((m) => {
          const value = computeMetric(m, entries);
          return (
            <div key={m.key}>
              <dt>この月の{m.label}</dt>
              <dd>{value === null ? '—' : m.agg === 'avg' ? formatAverage(value, m.unit) : formatMetricValue(value, m.unit)}</dd>
            </div>
          );
        })}
      </dl>

      {status.goal === null ? (
        <p className="ledger-status">この月の目標を書いてください。</p>
      ) : (
        <>
          <p className="ledger-goal-line">
            {status.goal.label !== '' ? status.goal.label : metric.label}（{status.goal.start} 〜 {status.goal.end}）
          </p>
          <p className="ledger-goal-line">
            {metric.label}{' '}
            {status.value === null ? 'まだ記録なし' : formatMetricValue(status.value, metric.unit)} /{' '}
            {formatMetricValue(status.goal.target, metric.unit)}
            {status.achieved ? ' · 達成' : ` · 進捗 ${Math.round(status.progress * 100)}%`}
          </p>
          <div className="ledger-coins" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < filledCoins ? 'is-filled' : undefined} />
            ))}
          </div>
          {status.achieved ? (
            <p className="ledger-status is-gold">目標を達成した。島の見た目が変わる。</p>
          ) : (
            <p className="ledger-status">目標に届くと、この月の島の見た目が変わる。</p>
          )}
        </>
      )}

      <form className="ledger-goal-form" onSubmit={submitGoal}>
        <label className="login-label" htmlFor="plugin-goal-target">
          目標（{metric.label}
          {metric.unit !== undefined ? ` · ${metric.unit}` : ''}、期間は自由）
        </label>
        <div className="login-row">
          <input
            className="input"
            type="date"
            aria-label="開始"
            value={goalStart}
            onChange={(e) => setGoalStart(e.target.value)}
          />
          <input
            className="input"
            type="date"
            aria-label="終了"
            value={goalEnd}
            onChange={(e) => setGoalEnd(e.target.value)}
          />
        </div>
        <div className="login-row">
          <input
            id="plugin-goal-target"
            className="input"
            inputMode="numeric"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder={metric.unit ?? '数値'}
          />
          <input
            className="input"
            value={goalLabel}
            onChange={(e) => setGoalLabel(e.target.value)}
            placeholder="名前（例: 中間テスト）"
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
        {goals.length > 0 ? (
          <ul className="ledger-list">
            {goals.map((goal) => (
              <li key={goal.id}>
                <span className="ledger-list-title">
                  {goal.label !== '' ? goal.label : metric.label} {goal.start}〜{goal.end} ·{' '}
                  {formatMetricValue(goal.target, metric.unit)}
                </span>
                <button type="button" className="link-btn" onClick={() => onRemoveGoal(goal.id)}>
                  消す
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <form className="ledger-entry-form" onSubmit={submitEntry}>
        <div className="ledger-entry-grid">
          <label>
            日
            <input className="input" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
        </div>
        {manifest.fields.map((field) => (
          <div key={field.key}>{fieldInput(field)}</div>
        ))}
        <button type="submit" className="btn btn-small">
          記録する
        </button>
        {entryError !== null ? (
          <p className="ledger-status" role="alert">
            {entryError}
          </p>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <p className="ledger-empty">この月の記録はまだありません。</p>
      ) : (
        <ol className="ledger-list">{entries.map(entryRow)}</ol>
      )}
    </aside>
  );
};
