import { MONTH_NAMES_EN, formatDateJa } from '../../lib/calendar';
import { breakdownByOwner, memberColor, ownerChipBackground } from '../../lib/members';
import { formatMetricValue, goalMetric } from '../../lib/pluginStatus';
import {
  CATEGORIES,
  CATEGORY_INFO,
  type CalendarEvent,
  type IslandLayout,
} from '../../types/calendar';
import type { PluginManifest, PluginStatus, PluginSummary } from '../../types/plugins';

export interface MonthHudProps {
  year: number;
  month: number;
  monthTotal: number;
  hoveredKey: string | null;
  /** 全員の予定（ホバーの内訳用。島の並べ方に関係なく全員分） */
  byDate: Map<string, CalendarEvent[]>;
  members: string[];
  currentUser: string;
  layout: IslandLayout;
  /** ふたりの島モードで奥の島にするメンバー。自分以外がいなければ null */
  partner: string | null;
  onToggleLayout: () => void;
  onSelectPartner: (name: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onShowYear: () => void;
  onLogout: () => void;
  /** 表示中プラグインの定義と、この月の目標・進捗 */
  manifest: PluginManifest;
  status: PluginStatus;
  /** 切り替えられるプラグイン */
  plugins: PluginSummary[];
  onSelectPlugin: (pluginId: string) => Promise<void>;
  onOpenPlugin: () => void;
}

const parseKey = (key: string): [number, number, number] => {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
};

const NO_EVENTS: CalendarEvent[] = [];

export const MonthHud = ({
  year,
  month,
  monthTotal,
  hoveredKey,
  byDate,
  members,
  currentUser,
  layout,
  partner,
  onToggleLayout,
  onSelectPartner,
  onPrevMonth,
  onNextMonth,
  onShowYear,
  onLogout,
  manifest,
  status,
  plugins,
  onSelectPlugin,
  onOpenPlugin,
}: MonthHudProps) => {
  const hovered = hoveredKey ? parseKey(hoveredKey) : null;
  const hoveredEvents = hoveredKey ? (byDate.get(hoveredKey) ?? NO_EVENTS) : NO_EVENTS;
  const breakdown = breakdownByOwner(hoveredEvents);
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  const allColors = members.map((m) => memberColor(members, m));
  const others = members.filter((m) => m !== currentUser);
  const split = layout === 'split' && partner !== null;
  const metric = goalMetric(manifest);
  const achieved = status.achieved;

  return (
    <div className="hud">
      <header className="hud-title">
        <div className="hud-month-number">{month}</div>
        <div className="hud-month-meta">
          <div className="hud-month-en">{MONTH_NAMES_EN[month - 1]}</div>
          <div className="hud-month-ja">
            {year}年{month}月 · 予定 {monthTotal} 件
          </div>
          <div className={achieved ? 'hud-savings is-gold' : 'hud-savings'}>
            {status.goal === null
              ? `${manifest.name}の目標なし`
              : `${status.goal.label !== '' ? status.goal.label : metric.label} ${
                  status.value === null ? '—' : formatMetricValue(status.value, metric.unit)
                } / ${formatMetricValue(status.goal.target, metric.unit)}`}
            {achieved ? ' · 達成' : null}
          </div>
        </div>
      </header>

      <nav className="hud-nav" aria-label="表示切り替え">
        <div className="hud-user panel">
          <span className="chip" style={{ background: memberColor(members, currentUser) }} />
          <span className="hud-user-name">{currentUser}</span>
          <button type="button" className="link-btn" onClick={onLogout}>
            ログアウト
          </button>
        </div>
        <button
          type="button"
          className="btn"
          disabled={partner === null}
          title={partner === null ? 'メンバーが 2 人以上いるときに使えます' : undefined}
          onClick={onToggleLayout}
        >
          {split ? 'ひとつの島で見る' : 'ふたりの島で見る'}
        </button>
        <label className="hud-plugin panel">
          <span className="hud-plugin-label">管理</span>
          <select
            className="hud-plugin-select"
            value={manifest.id}
            onChange={(e) => {
              onSelectPlugin(e.target.value).catch((err: unknown) => {
                console.error(err);
                window.alert(err instanceof Error ? err.message : String(err));
              });
            }}
          >
            {plugins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={onOpenPlugin}>
          {manifest.name}を開く
        </button>
        <button type="button" className="btn" onClick={onShowYear}>
          一年を見る
        </button>
      </nav>

      <nav className="hud-months" aria-label="月の移動">
        <button type="button" className="btn" onClick={onPrevMonth}>
          ◀ {prev}月
        </button>
        <button type="button" className="btn" onClick={onNextMonth}>
          {next}月 ▶
        </button>
      </nav>

      <aside className="hud-legend panel">
        <ul className="hud-legend-members">
          {members.map((member) => (
            <li key={member}>
              <span className="chip" style={{ background: memberColor(members, member) }} />
              {member}
            </li>
          ))}
          {members.length >= 2 ? (
            <li>
              <span className="chip" style={{ background: ownerChipBackground(allColors) }} />
              みんなの予定
            </li>
          ) : null}
        </ul>
        <ul className="hud-legend-categories">
          {CATEGORIES.map((category) => (
            <li key={category}>
              <span className="chip" style={{ background: CATEGORY_INFO[category].color }} />
              {CATEGORY_INFO[category].label}
            </li>
          ))}
        </ul>
        {split && others.length >= 2 ? (
          <div className="hud-partner" role="radiogroup" aria-label="奥の島にするメンバー">
            <span className="hud-partner-label">奥の島：</span>
            {others.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={name === partner}
                className={name === partner ? 'category-btn is-selected' : 'category-btn'}
                onClick={() => onSelectPartner(name)}
              >
                <span className="chip" style={{ background: memberColor(members, name) }} />
                {name}
              </button>
            ))}
          </div>
        ) : null}
        <p className="hud-hint">
          {split
            ? `手前が ${currentUser}、奥が ${partner} の島。ふたりの予定の日は、島と島を飛行機が行き来する`
            : 'ブロックの数 = 予定の数。ホバーで建物の足元に持ち主の色が出る。クリックで町へ降りる。目標を達成すると島の見た目が変わる'}
        </p>
      </aside>

      {hovered ? (
        <div className="hud-tooltip panel" role="status">
          <span>
            {formatDateJa(hovered[0], hovered[1], hovered[2])} — 予定 {hoveredEvents.length} 件
          </span>
          {hoveredEvents.length > 0 ? (
            <span className="hud-tooltip-owners">
              {members.map((member) => {
                const count = breakdown.solo.get(member) ?? 0;
                return count > 0 ? (
                  <span key={member}>
                    <span className="chip" style={{ background: memberColor(members, member) }} />
                    {member} {count}
                  </span>
                ) : null;
              })}
              {breakdown.shared > 0 ? (
                <span>
                  <span className="chip" style={{ background: ownerChipBackground(allColors) }} />
                  みんな {breakdown.shared}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
