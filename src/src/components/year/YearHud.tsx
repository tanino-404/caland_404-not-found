import type { PluginSummary } from '../../types/plugins';
import { ELEVATION_COLORS, LUXURY_ELEVATION_COLORS } from '../models/blocks/blockKinds';
import './YearHud.css';

export interface YearHudProps {
  year: number;
  /** その年の予定の合計 */
  total: number;
  hoveredMonth: number | null;
  /** ホバー中の月の件数と、表示中プラグインで変わった島の名前（変わっていなければ null） */
  hoveredCount: number;
  hoveredThemeLabel: string | null;
  /** ホバー中の月に目標を達成したプラグイン（全プラグイン。★ の数） */
  hoveredAchieved: PluginSummary[];
  /** 表示中のプラグインの名前 */
  pluginName: string;
  /** 目標の達成を読み込めなかったときのメッセージ */
  achievementsError: string | null;
  /** 友達の年ビューのときの友達の名前。null なら自分たちの年 */
  friend: string | null;
}

/** 標高チップの見出し。ELEVATION_COLORS と同じ順（0 = 海、6+ = 雪山） */
const ELEVATION_LABELS = ['0', '1', '2', '3', '4', '5', '6+'];

/** 年ビューの HUD。前年・翌年の矢印は親が SideArrows で置くので、ここでは出さない */
export const YearHud = ({
  year,
  total,
  hoveredMonth,
  hoveredCount,
  hoveredThemeLabel,
  hoveredAchieved,
  pluginName,
  achievementsError,
  friend,
}: YearHudProps) => (
  <div className="hud">
    <header className="hud-title">
      <div className="hud-month-number">{year}</div>
      <div className="hud-month-meta">
        <div className="hud-month-en">{friend === null ? '一年を、上から見る。' : `${friend} の一年を、上から見る。`}</div>
        <div className="hud-month-ja">
          {friend === null ? '12 の島' : `${friend} の 12 の島`} · 予定 {total} 件
        </div>
      </div>
    </header>

    <aside className="hud-legend panel year-hud-legend">
      <div className="year-hud-steps" aria-label="ブロックの高さと予定の数">
        <span className="year-hud-steps-end">海</span>
        {ELEVATION_COLORS.map((color, i) => (
          <span key={color} className="year-hud-step">
            <span className="chip" style={{ background: color }} />
            <small>{ELEVATION_LABELS[i]}</small>
          </span>
        ))}
        <span className="year-hud-steps-end">雪山</span>
      </div>
      <div className="year-hud-gold">
        <span className="chip" style={{ background: LUXURY_ELEVATION_COLORS[2] }} />
        目標を達成した月（{pluginName}）
      </div>
      {achievementsError !== null ? (
        <p className="hud-hint" role="alert">
          目標の達成を読み込めません: {achievementsError}
        </p>
      ) : null}
      <p className="hud-hint">ブロックの段数 = その日の予定の数。島をクリックで月へ降りる</p>
    </aside>

    {hoveredMonth !== null ? (
      <div className="hud-tooltip panel" role="status">
        <span>
          {hoveredMonth}月 · 予定 {hoveredCount} 件{hoveredThemeLabel !== null ? ` · ${hoveredThemeLabel}` : ''}
        </span>
        {hoveredAchieved.length > 0 ? (
          <span className="year-hud-stars" title={hoveredAchieved.map((p) => p.name).join('・')}>
            {'★'.repeat(hoveredAchieved.length)} {hoveredAchieved.map((p) => p.name).join('・')}
          </span>
        ) : null}
      </div>
    ) : null}
  </div>
);
