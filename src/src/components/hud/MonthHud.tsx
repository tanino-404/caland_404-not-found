import { MONTH_NAMES_EN, formatDateJa } from '../../lib/calendar';
import { breakdownByOwner, memberColor, ownerChipBackground } from '../../lib/members';
import {
  CATEGORIES,
  CATEGORY_INFO,
  type CalendarEvent,
  type IslandLayout,
} from '../../types/calendar';

/** 管理プラグイン 1 つぶんの、この月の進捗表示 */
export interface MonthPluginSummary {
  id: string;
  title: string;
  /** 例: 貯金 129,000円 / 50,000円。目標なしなら「目標なし」を含む文 */
  summary: string;
  achieved: boolean;
  /** 達成した月の呼び名（例: 黄金郷）。任意 */
  achievedLabel?: string;
}

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
  /** 管理プラグイン。並びはサーバーの順。ボタンと進捗行をここから生成する */
  plugins: MonthPluginSummary[];
  onOpenPlugin: (pluginId: string) => void;
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
  plugins,
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

  return (
    <div className="hud">
      <header className="hud-title">
        <div className="hud-month-number">{month}</div>
        <div className="hud-month-meta">
          <div className="hud-month-en">{MONTH_NAMES_EN[month - 1]}</div>
          <div className="hud-month-ja">
            {year}年{month}月 · 予定 {monthTotal} 件
          </div>
          {plugins.map((plugin) => (
            <div key={plugin.id} className={plugin.achieved ? 'hud-savings is-gold' : 'hud-savings'}>
              {plugin.summary}
              {plugin.achieved && plugin.achievedLabel !== undefined
                ? ` · ${plugin.achievedLabel}`
                : null}
            </div>
          ))}
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
        {plugins.map((plugin) => (
          <button key={plugin.id} type="button" className="btn" onClick={() => onOpenPlugin(plugin.id)}>
            {plugin.title}
          </button>
        ))}
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
            : 'ブロックの数 = 予定の数。ホバーで建物の足元に持ち主の色が出る。クリックで町へ降りる。管理の目標を達成すると島の見た目が変わる'}
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
