import { noise, paintPixels, type SetPixel } from '@plugin-sdk';

/**
 * 漁業の島の塔のドット絵テクスチャ。苔の付いた濃い岩と、潮に洗われた砂岩。
 * 上の縁に海水がかかった明るい水色の帯があり、そこだけ光る。天面は芝。
 */

const TIDE_HI = '#bff4ff';
const TIDE = '#5fd0f5';
const ROCK = ['#4a5560', '#525e6a', '#434d58', '#5a6672'];
const ROCK_MORTAR = '#2c343d';
const SANDSTONE = ['#d9bf7a', '#cfb46c', '#e2c98a', '#c6a960'];
const SANDSTONE_MORTAR = '#9c8448';
const MOSS = ['#3e8a2a', '#4f9e30', '#5fb63b'];

const paint = (width: number, height: number, painter: (set: SetPixel) => void) =>
  paintPixels(width, height, new Set([TIDE_HI, TIDE]), painter);

/** 上の行は潮の帯。2 行目に苔が垂れ、下は半分ずらした石積み */
const seawall = (set: SetPixel, faces: string[], mortar: string, salt: number) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      if (y === 0) {
        set(x, y, noise(x, 0, salt) > 0.7 ? TIDE_HI : TIDE);
        continue;
      }
      if (y <= 2 && noise(x, 0, salt + 1) > 0.65 && noise(x, y, salt + 2) > 0.35) {
        set(x, y, MOSS[Math.floor(noise(x, y, salt + 3) * MOSS.length)]);
        continue;
      }
      const shift = y < 5 ? 0 : 3;
      if (y === 4 || (x + shift) % 6 === 0) {
        set(x, y, mortar);
        continue;
      }
      set(x, y, faces[Math.floor(noise(x, y, salt + 4) * faces.length)]);
    }
  }
};

export const FISH_ROCK_SIDE = paint(16, 8, (set) => seawall(set, ROCK, ROCK_MORTAR, 41));

export const FISH_SAND_SIDE = paint(16, 8, (set) => seawall(set, SANDSTONE, SANDSTONE_MORTAR, 51));
