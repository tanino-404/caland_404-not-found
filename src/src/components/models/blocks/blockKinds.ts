export type BlockKind = 'grass' | 'shore' | 'dirt' | 'stone' | 'snow';

export const BLOCK_COLORS = {
  grassTop: '#5fb63b',
  sand: '#e8d9a0',
  sandDark: '#d3c288',
  sea: '#3aa0e6',
  water: '#4fb3f0',
  dirt: '#8b5a2b',
  dirtDark: '#754a22',
  stone: '#8d8f93',
  stoneDark: '#75777b',
  snow: '#f4f8ff',
  snowSide: '#dbe6f5',
} as const;

/**
 * いつもの島のブロック。level 0 = 海に接する島の縁。1〜2 = 土（天面なら草）。3〜5 = 石。6 以上 = 雪。
 * 目標を達成した島のブロックはプラグインの島（IslandDefinition.blocks）が決める。
 */
export const plainBlockKind = (level: number, isTop: boolean): BlockKind => {
  if (level === 0) return 'shore';
  if (level <= 2) return isTop ? 'grass' : 'dirt';
  if (level <= 5) return 'stone';
  return 'snow';
};

/** ヒートマップ用：予定数 → 標高色（3D ブロックと同じスケール） */
export const ELEVATION_COLORS = [
  BLOCK_COLORS.sea,
  '#7d5a2f',
  BLOCK_COLORS.dirt,
  BLOCK_COLORS.stoneDark,
  BLOCK_COLORS.stone,
  BLOCK_COLORS.snowSide,
  BLOCK_COLORS.snow,
] as const;
