import { type SetPixel, noise, paintPixels } from './pixelTexture';

/**
 * 知識の島（図書館）の塔のドット絵テクスチャ。明るい石灰岩とグレーの石のレンガ、上の縁にツタ。天面は芝。
 * 光る部分は無い（落ち着いた島にする）。
 */

const LIME = ['#e6e0d0', '#ddd6c4', '#ece7da', '#d4cdb9'];
const LIME_MORTAR = '#b8b09a';
const GRAY = ['#8f949b', '#868b93', '#9ba0a7', '#7e838b'];
const GRAY_MORTAR = '#6a6f77';
const MOSS = ['#4f9e30', '#5fb63b', '#3e8a2a'];

const paint = (width: number, height: number, painter: (set: SetPixel) => void) =>
  paintPixels(width, height, new Set<string>(), painter);

/** 横長の切石を半分ずらして積む。上の行と、ところどころ 2 行目まで垂れるツタ */
const ashlar = (set: SetPixel, faces: string[], mortar: string, salt: number) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const vine = y === 0 || (y <= 2 && noise(x, 0, salt) > 0.72 && noise(x, y, salt + 1) > 0.3);
      if (vine) {
        set(x, y, MOSS[Math.floor(noise(x, y, salt + 2) * MOSS.length)]);
        continue;
      }
      const row = y < 4 ? 0 : 1;
      const shift = row === 0 ? 0 : 5;
      if (y === 4 || y === 7 || (x + shift) % 10 === 0) {
        set(x, y, mortar);
        continue;
      }
      set(x, y, faces[Math.floor(noise(x, y, salt + 3) * faces.length)]);
    }
  }
};

export const LIB_LIME_SIDE = paint(16, 8, (set) => ashlar(set, LIME, LIME_MORTAR, 21));

export const LIB_GRAY_SIDE = paint(16, 8, (set) => ashlar(set, GRAY, GRAY_MORTAR, 31));
