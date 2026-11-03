/**
 * 島の見た目。目標達成エフェクト（plugin.json の effects[].theme）が
 * `lib/effects.ts` の対応表でこのどれかに割り当てられる。
 * - plain：いつもの草・土・石・雪
 * - luxury：目標を達成した黄金郷
 * - muscle：目標を達成したマッチョの島（巨大なボディビルダー・プロテイン）
 */
export type IslandTheme = 'plain' | 'luxury' | 'muscle';
