import { noise, paintPixels, type SetPixel } from '@plugin-sdk';

/**
 * マッチョの島の塔のドット絵テクスチャ。灰色の石レンガと濃いスレートのレンガ（天面の芝は SDK の GRASS_TOP_MATERIAL）。
 * 上の縁の明るい帯だけが光る。
 */

const TRIM_HI = '#fff4c2';
const TRIM = '#f2d77a';
const STONE = ['#9aa0a8', '#8c929b', '#a6acb4', '#858b94'];
const STONE_MORTAR = '#6c717a';
const SLATE = ['#3c465a', '#434e63', '#363f52', '#4a556b'];
const SLATE_MORTAR = '#262d3b';

const paint = (width: number, height: number, painter: (set: SetPixel) => void) =>
  paintPixels(width, height, new Set([TRIM_HI, TRIM]), painter);

/** 横 8・縦 3 のレンガを半分ずらして積む。上の行は明るい縁 */
const bricks = (set: SetPixel, faces: string[], mortar: string) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      if (y === 0) {
        set(x, y, x % 6 === 1 ? TRIM_HI : TRIM);
        continue;
      }
      const row = Math.floor((y - 1) / 3.5);
      const shift = row % 2 === 0 ? 0 : 4;
      const mortarRow = y === 4 || y === 7;
      const mortarCol = (x + shift) % 8 === 0;
      if (mortarRow || mortarCol) {
        set(x, y, mortar);
        continue;
      }
      set(x, y, faces[Math.floor(noise(x, y, 9) * faces.length)]);
    }
  }
};

export const GYM_STONE_SIDE = paint(16, 8, (set) => bricks(set, STONE, STONE_MORTAR));

export const GYM_SLATE_SIDE = paint(16, 8, (set) => bricks(set, SLATE, SLATE_MORTAR));
