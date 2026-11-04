import { noise, paintPixels, type SetPixel } from '@plugin-sdk';

/**
 * 黄金郷の塔のドット絵テクスチャ。金の縁とガラスの照りだけが光る。
 */

const GOLD_HI = '#fff1a0';
const GOLD = '#f5c842';
const GOLD_MID = '#e0a81e';
const GOLD_LO = '#a8740c';
const STONE = ['#24232c', '#2b2a35', '#1e1d25', '#302f3b'];
const GLASS_HI = '#c8f6ff';
const GLASS = '#5fd2f5';
const GLASS_LO = '#2a8fc4';
const MULLION = '#1a1922';
const GLOW = new Set([GOLD_HI, GOLD, GOLD_MID, GOLD_LO, GLASS_HI]);

const paint = (width: number, height: number, painter: (set: SetPixel) => void) =>
  paintPixels(width, height, GLOW, painter);

/** 金の縁取り：上の行は明るく、下の行は暗く、左右の柱は中間 */
const goldFrame = (set: SetPixel, w: number, h: number) => {
  for (let x = 0; x < w; x++) {
    set(x, 0, x % 5 === 2 ? GOLD_HI : GOLD);
    set(x, h - 1, GOLD_LO);
  }
  for (let y = 1; y < h - 1; y++) {
    set(0, y, GOLD_MID);
    set(w - 1, y, GOLD_LO);
  }
};

/** 黒曜石の壁＋金の縁 */
export const LUXURY_STONE_SIDE = paint(16, 8, (set) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      set(x, y, STONE[Math.floor(noise(x, y, 1) * STONE.length)]);
    }
  }
  goldFrame(set, 16, 8);
  // 中央の金の飾り帯
  for (let x = 3; x < 13; x++) set(x, 4, x % 2 === 0 ? GOLD_MID : GOLD_LO);
});

/** ガラス張りの壁：金の枠、黒い桟、空を映す水色のガラス */
export const LUXURY_GLASS_SIDE = paint(16, 8, (set) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const mullion = x % 5 === 0 || y === 4;
      if (mullion) {
        set(x, y, MULLION);
        continue;
      }
      // 斜めの映り込み
      const shine = (x + y) % 9 === 0 || (x + y) % 9 === 1;
      set(x, y, shine ? GLASS_HI : y < 4 ? GLASS : GLASS_LO);
    }
  }
  goldFrame(set, 16, 8);
});

/** 屋上：金と大理石の市松タイル */
export const LUXURY_TOP = paint(16, 16, (set) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      if (edge) {
        set(x, y, GOLD_MID);
        continue;
      }
      const tile = (Math.floor(x / 5) + Math.floor(y / 5)) % 2 === 0;
      const speck = noise(x, y, 3) > 0.86;
      set(x, y, tile ? (speck ? GOLD_HI : GOLD) : speck ? '#e9e2d0' : '#f7f1e3');
    }
  }
});

/** 浜：砂金の側面、上だけ金 */
export const LUXURY_SHORE_SIDE = paint(16, 8, (set) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const n = noise(x, y, 5);
      set(x, y, n > 0.8 ? '#fff0b8' : n > 0.4 ? '#f6d98a' : '#e8c56e');
    }
  }
  for (let x = 0; x < 16; x++) set(x, 0, x % 4 === 1 ? GOLD_HI : GOLD);
});
