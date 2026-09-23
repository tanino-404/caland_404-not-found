/** 月ごとの空気感・地面色・パーティクル種別 */
/** clear = 降るものなし（真夏の快晴など） */
export type SeasonEffect = 'snow' | 'sakura' | 'fresh' | 'rain' | 'clear' | 'autumn';

export interface MonthSeason {
  /** HUD 用の短い季節ラベル */
  label: string;
  effect: SeasonEffect;
  /** 予定がある塔の天面だけ。側面の標高色は変えない */
  landTop: string;
  grassTop: string;
  sand: string;
  sea: string;
  fog: string;
  skyTop: string;
  skyHorizon: string;
  ambient: string;
  hemisphereTop: string;
  hemisphereGround: string;
  sun: string;
}

const BASE_GRASS = '#5fb63b';
const BASE_SAND = '#e8d9a0';
const BASE_SEA = '#3aa0e6';

/** 塔の天面一面。落ち葉は茶〜橙、桜はピンク、雪は白。建物より下の面なのでオブジェクトには被さらない */
const LAND_TOP: Record<number, string> = {
  1: '#eef6ff',
  2: '#e7f1fb',
  3: '#ffb0cc',
  4: '#ffc4d8',
  5: '#7ed44a',
  6: '#3f7a38',
  7: '#4a8a40',
  8: '#4aaa32',
  9: '#c48830',
  10: '#d06820',
  11: '#a34a18',
  12: '#f4f8ff',
};

/** 1〜12 月の見た目。標高（予定数）の色スケールは変えず、島の「季節」だけを変える */
const monthLook = (month: number): Omit<MonthSeason, 'landTop'> => {
  switch (month) {
    case 1:
      return {
        label: '雪 · 冬',
        effect: 'snow',
        grassTop: '#8fbf7a',
        sand: '#e4edf5',
        sea: '#2d7fbf',
        fog: '#dce8f5',
        skyTop: '#7aa8d4',
        skyHorizon: '#dce8f5',
        ambient: '#eef4ff',
        hemisphereTop: '#d8e8ff',
        hemisphereGround: '#b8c8a8',
        sun: '#fff8ef',
      };
    case 2:
      return {
        label: '雪 · 冬',
        effect: 'snow',
        grassTop: '#7fb86a',
        sand: '#dde8f0',
        sea: '#3088c8',
        fog: '#d4e4f4',
        skyTop: '#6a9ccc',
        skyHorizon: '#d4e4f4',
        ambient: '#edf2ff',
        hemisphereTop: '#cce0ff',
        hemisphereGround: '#a8b898',
        sun: '#fff6e8',
      };
    case 3:
      return {
        label: '桜 · 春',
        effect: 'sakura',
        grassTop: '#6ec04a',
        sand: '#efe0c8',
        sea: '#3aa8e8',
        fog: '#ffd0e8',
        skyTop: '#88c8ff',
        skyHorizon: '#ffb8d8',
        ambient: '#fff0f4',
        hemisphereTop: '#ffd6e8',
        hemisphereGround: '#c9b48a',
        sun: '#fff4e8',
      };
    case 4:
      return {
        label: '桜 · 春',
        effect: 'sakura',
        grassTop: '#72c44e',
        sand: '#f0e4cc',
        sea: '#42b0f0',
        fog: '#ffe0ec',
        skyTop: '#68b8ff',
        skyHorizon: '#ffd0e0',
        ambient: '#fff0f6',
        hemisphereTop: '#ffc8dc',
        hemisphereGround: '#c9b48a',
        sun: '#fff8ec',
      };
    case 5:
      return {
        label: '新緑 · 春',
        effect: 'fresh',
        grassTop: '#48b832',
        sand: BASE_SAND,
        sea: '#38a8ea',
        fog: '#dff8e8',
        skyTop: '#58b8ff',
        skyHorizon: '#d0f0e0',
        ambient: '#f0fff4',
        hemisphereTop: '#c8f0d8',
        hemisphereGround: '#b0c878',
        sun: '#fff8e0',
      };
    case 6:
      return {
        label: '梅雨 · 夏',
        effect: 'rain',
        grassTop: '#4a9e38',
        sand: '#c8c0a0',
        sea: '#2a7aaa',
        fog: '#b8c8d8',
        skyTop: '#688898',
        skyHorizon: '#a8b8c8',
        ambient: '#d8e0e8',
        hemisphereTop: '#b0c0d0',
        hemisphereGround: '#8a9078',
        sun: '#e8eef4',
      };
    case 7:
      return {
        label: '梅雨 · 夏',
        effect: 'rain',
        grassTop: '#52a83c',
        sand: '#d0c898',
        sea: '#2e82b0',
        fog: '#c0d0e0',
        skyTop: '#7098b0',
        skyHorizon: '#b0c4d8',
        ambient: '#e0e8f0',
        hemisphereTop: '#a8c4e0',
        hemisphereGround: '#909878',
        sun: '#f0f4ff',
      };
    case 8:
      return {
        label: '真夏 · 快晴',
        effect: 'clear',
        grassTop: '#3a9828',
        sand: '#f0d890',
        sea: BASE_SEA,
        fog: '#cfeeff',
        skyTop: '#48a8ff',
        skyHorizon: '#cfeeff',
        ambient: '#fff8e8',
        hemisphereTop: '#dff3ff',
        hemisphereGround: '#d0a868',
        sun: '#fff0c8',
      };
    case 9:
      return {
        label: '初秋',
        effect: 'autumn',
        grassTop: '#6a9e40',
        sand: '#e8d0a0',
        sea: '#3898d8',
        fog: '#ffe8c8',
        skyTop: '#68a8e8',
        skyHorizon: '#ffd8a8',
        ambient: '#fff4e0',
        hemisphereTop: '#ffd8a0',
        hemisphereGround: '#b89868',
        sun: '#fff0d0',
      };
    case 10:
      return {
        label: '紅葉 · 秋',
        effect: 'autumn',
        grassTop: '#8a9840',
        sand: '#e0c890',
        sea: '#3488c8',
        fog: '#ffb878',
        skyTop: '#88a8d0',
        skyHorizon: '#ff9850',
        ambient: '#fff0d8',
        hemisphereTop: '#ffb878',
        hemisphereGround: '#a88050',
        sun: '#ffe8c0',
      };
    case 11:
      return {
        label: '紅葉 · 秋',
        effect: 'autumn',
        grassTop: '#849048',
        sand: '#d8c088',
        sea: '#3078b8',
        fog: '#f8c898',
        skyTop: '#7098c8',
        skyHorizon: '#f0b878',
        ambient: '#fff0d0',
        hemisphereTop: '#f0a868',
        hemisphereGround: '#987848',
        sun: '#ffe0b0',
      };
    case 12:
      return {
        label: '雪 · 冬',
        effect: 'snow',
        grassTop: '#7aaa68',
        sand: '#e0e8f0',
        sea: '#2a78b8',
        fog: '#d8e8f8',
        skyTop: '#78a0c8',
        skyHorizon: '#d8e8f8',
        ambient: '#eef4ff',
        hemisphereTop: '#c8dcf8',
        hemisphereGround: '#a0b090',
        sun: '#fff6ee',
      };
    default:
      return {
        label: '',
        effect: 'fresh',
        grassTop: BASE_GRASS,
        sand: BASE_SAND,
        sea: BASE_SEA,
        fog: '#cfeeff',
        skyTop: '#5cb0ff',
        skyHorizon: '#cfeeff',
        ambient: '#fff4e0',
        hemisphereTop: '#dff3ff',
        hemisphereGround: '#c9b48a',
        sun: '#fff1d6',
      };
  }
};

export const monthSeason = (month: number): MonthSeason => ({
  ...monthLook(month),
  landTop: LAND_TOP[month] ?? BASE_GRASS,
});
