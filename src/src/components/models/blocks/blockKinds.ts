export type BlockKind = 'grass' | 'dirt' | 'stone' | 'snow';

export const BLOCK_COLORS = {
  grassTop: '#5fb63b',
  dirt: '#8b5a2b',
  dirtDark: '#754a22',
  stone: '#8d8f93',
  stoneDark: '#75777b',
  snow: '#f4f8ff',
  snowSide: '#dbe6f5',
} as const;

/**
 * level 0 = 地面。1〜2 = 土（天面なら草）。3〜5 = 石。6 以上 = 雪。
 */
export const blockKindForLevel = (level: number, isTop: boolean): BlockKind => {
  if (level === 0) return 'grass';
  if (level <= 2) return isTop ? 'grass' : 'dirt';
  if (level <= 5) return 'stone';
  return 'snow';
};

/** ヒートマップ用：予定数 → 標高色（3D ブロックと同じスケール） */
export const ELEVATION_COLORS = [
  BLOCK_COLORS.grassTop,
  '#7d5a2f',
  BLOCK_COLORS.dirt,
  BLOCK_COLORS.stoneDark,
  BLOCK_COLORS.stone,
  BLOCK_COLORS.snowSide,
  BLOCK_COLORS.snow,
] as const;

export const elevationColor = (eventCount: number): string =>
  ELEVATION_COLORS[Math.min(eventCount, ELEVATION_COLORS.length - 1)];
