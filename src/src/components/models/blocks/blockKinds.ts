import type { IslandTheme } from '../../../types/island';

export type BlockKind =
  | 'grass'
  | 'shore'
  | 'dirt'
  | 'stone'
  | 'snow'
  | 'goldShore'
  | 'gold'
  | 'marble'
  | 'goldGlass';

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
  goldTop: '#ffe56a',
  gold: '#f0c43a',
  goldDark: '#d4a017',
  goldSand: '#f6d98a',
  marble: '#f4efe3',
  marbleSide: '#e6d7b8',
  goldGlass: '#ffd24a',
  goldGlassSide: '#1c2a44',
  luxuryWater: '#4fd0f0',
  luxurySea: '#2eb8e8',
} as const;

/**
 * level 0 = 海に接する島の縁。1〜2 = 土（天面なら草）。3〜5 = 石。6 以上 = 雪。
 * 黄金郷では砂金の浜と、上まで金の塔。$ は高い塔の側面に載せる。
 */
export const blockKindForLevel = (
  level: number,
  isTop: boolean,
  theme: IslandTheme,
): BlockKind => {
  if (theme === 'luxury') {
    if (level === 0) return 'goldShore';
    return 'gold';
  }
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

export const LUXURY_ELEVATION_COLORS = [
  BLOCK_COLORS.luxurySea,
  BLOCK_COLORS.goldSand,
  BLOCK_COLORS.gold,
  BLOCK_COLORS.goldTop,
  BLOCK_COLORS.marbleSide,
  BLOCK_COLORS.marble,
  BLOCK_COLORS.goldGlass,
] as const;

export const elevationColor = (eventCount: number, theme: IslandTheme = 'plain'): string => {
  const scale = theme === 'luxury' ? LUXURY_ELEVATION_COLORS : ELEVATION_COLORS;
  return scale[Math.min(eventCount, scale.length - 1)];
};
