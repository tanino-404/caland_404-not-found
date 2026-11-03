import { MONTH_NAMES_EN, formatDateJa } from '../../lib/calendar';
import { breakdownByOwner, memberColor, ownerChipBackground } from '../../lib/members';
import { formatMetricValue, goalMetric } from '../../lib/pluginStatus';
import { CATEGORIES, CATEGORY_INFO, type CalendarEvent } from '../../types/calendar';
import type { PluginManifest, PluginStatus } from '../../types/plugins';

export interface MonthHudProps {
  year: number;
  month: number;
  monthTotal: number;
  hoveredKey: string | null;
  /** 全員の予定（ホバーの内訳用） */
  byDate: Map<string, CalendarEvent[]>;
  members: string[];
  currentUser: string;
  /** 表示中プラグインの定義と、この月の目標・進捗。読み込みに失敗したら null */
  plugin: { manifest: PluginManifest; status: PluginStatus } | null;
  pluginError: string | null;
}

const parseKey = (key: string): [number, number, number] => {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
};

const NO_EVENTS: CalendarEvent[] = [];

/** 月ビューの HUD。表示の切り替えは画面下部の BottomBar、月送りは画面左右の SideArrows が持つので、ここはカレンダーの情報だけ出す */
export const MonthHud = ({
  year,
  month,
  monthTotal,
  hoveredKey,
  byDate,
  members,
  currentUser,
  plugin,
  pluginError,
}: MonthHudProps) => {
  const hovered = hoveredKey ? parseKey(hoveredKey) : null;
  const hoveredEvents = hoveredKey ? (byDate.get(hoveredKey) ?? NO_EVENTS) : NO_EVENTS;
  const breakdown = breakdownByOwner(hoveredEvents);
  const allColors = members.map((m) => memberColor(members, m));
  const status = plugin?.status ?? null;
  const metric = plugin === null ? null : goalMetric(plugin.manifest, plugin.status.goal?.metric);
  const achieved = status?.achieved ?? false;

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
            {plugin === null || status === null || metric === null
              ? `管理プラグインを読み込めません${pluginError === null ? '' : `：${pluginError}`}`
              : status.goal === null
                ? `${plugin.manifest.name}の目標なし`
                : `${status.goal.label !== '' ? status.goal.label : metric.label} ${
                    status.value === null ? '—' : formatMetricValue(status.value, metric.unit)
                  } ${status.op === '<=' ? '≦' : '/'} ${formatMetricValue(status.goal.target, metric.unit)}`}
            {achieved ? ' · 達成' : null}
          </div>
        </div>
      </header>

      <nav className="hud-nav" aria-label="ログイン中のメンバー">
        <div className="hud-user panel">
          <span className="chip" style={{ background: memberColor(members, currentUser) }} />
          <span className="hud-user-name">{currentUser}</span>
        </div>
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
        <p className="hud-hint">
          ブロックの数 = 予定の数。ホバーで建物の足元に持ち主の色が出る。クリックで町へ降りる。貯金目標を達成すると島が黄金郷になる
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
