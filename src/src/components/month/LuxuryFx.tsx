import { DoubleSide, MeshStandardMaterial } from 'three';
import { pixelArtGeometry } from '../models/pixelArt';
import { buildFallers } from './fallers';
import { Glints, PixelRain, type RainItem, SunFlare } from './SkyFx';

// ---------- ドット絵のお金 ----------

const DOLLAR = ['..#..', '.####', '#.#..', '#.#..', '.###.', '..#.#', '..#.#', '####.', '..#..'];

/** 14×14 の金貨。縁・内側の輪・左上の照り・打刻した $ */
const COIN_ROWS: string[] = (() => {
  const size = 14;
  const c = (size - 1) / 2;
  const rows: string[][] = [];
  for (let y = 0; y < size; y++) {
    const row: string[] = [];
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r > 6.7) row.push('.');
      else if (r > 5.7) row.push(x + y < size - 3 ? 'h' : 'o');
      else if (r > 4.6 && r <= 5.2) row.push('m');
      else row.push(x + y < 9 ? 'l' : 'y');
    }
    rows.push(row);
  }
  DOLLAR.forEach((line, dy) => {
    [...line].forEach((char, dx) => {
      if (char === '#') rows[2 + dy][5 + dx] = 'd';
    });
  });
  return rows.map((row) => row.join(''));
})();

const COIN_PALETTE = {
  o: '#a86a00',
  h: '#ffe680',
  m: '#d98c00',
  y: '#f5b800',
  l: '#ffd23a',
  d: '#7a4400',
};

/** 26×12 の札。濃い緑の縁、内側の枠、真ん中に肖像の楕円、両端に $ */
const BILL_ROWS: string[] = (() => {
  const w = 26;
  const h = 12;
  const rows: string[][] = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) row.push('g');
      else if (x === 2 || y === 2 || x === w - 3 || y === h - 3) row.push('f');
      else {
        const ex = (x - (w - 1) / 2) / 4.2;
        const ey = (y - (h - 1) / 2) / 3.6;
        const e = ex * ex + ey * ey;
        if (e <= 0.45) row.push(y < 6 ? 'k' : 's');
        else if (e <= 1) row.push('p');
        else row.push((x + y) % 3 === 0 ? 'l' : 'b');
      }
    }
    rows.push(row);
  }
  const mini = ['.#.', '###', '#..', '###', '..#', '###', '.#.'];
  for (const left of [4, w - 7]) {
    mini.forEach((line, dy) => {
      [...line].forEach((char, dx) => {
        if (char === '#' && 2 + dy < h - 2) rows[2 + dy][left + dx] = 'g';
      });
    });
  }
  return rows.map((row) => row.join(''));
})();

const BILL_PALETTE = {
  g: '#1f6b3e',
  f: '#4f9a5a',
  b: '#9fd88a',
  l: '#c6efb2',
  p: '#76c27a',
  k: '#2f6b3d',
  s: '#d9f5c8',
};

const COIN_GEOMETRY = pixelArtGeometry(COIN_ROWS, COIN_PALETTE, 2);
const BILL_GEOMETRY = pixelArtGeometry(BILL_ROWS, BILL_PALETTE, 0.6);
const COIN_MAT = new MeshStandardMaterial({
  vertexColors: true,
  metalness: 0.3,
  roughness: 0.38,
  emissive: '#ff9a00',
  emissiveIntensity: 0.08,
});
const BILL_MAT = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: DoubleSide });

const MONEY: RainItem[] = [
  {
    geometry: COIN_GEOMETRY,
    material: COIN_MAT,
    fallers: [...buildFallers(64, 10, 0.045, false), ...buildFallers(9, 20, 0.045, true)],
    motion: 'spin',
  },
  {
    geometry: BILL_GEOMETRY,
    material: BILL_MAT,
    fallers: [...buildFallers(28, 30, 0.03, false), ...buildFallers(6, 40, 0.03, true)],
    motion: 'flutter',
  },
];

/** 黄金郷の空：ドット絵のお金の雨、きらめき、レンズフレア */
export const LuxuryFx = () => (
  <group>
    <PixelRain items={MONEY} />
    <Glints />
    <SunFlare />
  </group>
);
