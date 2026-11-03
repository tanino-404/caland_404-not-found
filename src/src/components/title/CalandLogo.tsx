import type { ReactElement } from 'react';

/**
 * ワードマーク「CALAND」のピクセルアート。
 * 5×7 のピクセルフォントを 2 倍に太らせ、インクの輪郭 + 紙〜金の 2 色塗り + 硬い落ち影で描き、
 * 足元にブロックの島（草の天面・土の側面・砂浜・波）を敷く。グリッドは文字の 2 次元配列で組み立て、
 * 横に続く同色のピクセルを 1 本の <rect> にまとめる（icons/index.tsx の PixelArt と同じ考え方）。
 */

const INK = '#1b2a41';
const PAPER = '#fff8e7';
const GOLD_LIGHT = '#ffe08a';
const GOLD = '#ffc83d';
const GRASS = '#5fb63b';
const GRASS_LIGHT = '#7fd05a';
const DIRT = '#8b5a2b';
const DIRT_DARK = '#6f4521';
const SAND = '#e8d49a';
const SEA = '#5cb0ff';
const FOAM = '#cfeeff';

const PALETTE: Record<string, string> = {
  k: INK,
  p: PAPER,
  h: GOLD_LIGHT,
  g: GOLD,
  G: GRASS,
  L: GRASS_LIGHT,
  D: DIRT,
  d: DIRT_DARK,
  S: SAND,
  b: SEA,
  w: FOAM,
};

/** 5×7 の大文字。'#' が点灯 */
const GLYPHS: Record<string, readonly string[]> = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
};

const TEXT = 'CALAND';
const GLYPH_W = 5;
const GLYPH_H = 7;
/** 文字を太らせる倍率 */
const SCALE = 2;
const LETTER_W = GLYPH_W * SCALE;
const LETTER_H = GLYPH_H * SCALE;
const LETTER_GAP = 3;
const SHADOW = 2;

const LETTER_TOP = 1;
const LETTER_LEFT = 1;
const TEXT_W = TEXT.length * LETTER_W + (TEXT.length - 1) * LETTER_GAP;
const GRID_W = TEXT_W + LETTER_LEFT * 2 + SHADOW;
/** 文字 + 輪郭 + 影の下に、島（草 2・土 3）と波 2 行 */
const ISLAND_TOP = LETTER_TOP + LETTER_H + 1 + SHADOW;
const GRID_H = ISLAND_TOP + 7;

type Grid = string[][];

const makeGrid = (): Grid => Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => '.'));

const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;

const fillRow = (grid: Grid, y: number, x0: number, x1: number, ch: string) => {
  for (let x = x0; x <= x1; x += 1) {
    if (inBounds(x, y)) grid[y][x] = ch;
  }
};

/** 塗ってあるピクセルに 8 近傍で接する空きピクセルをインクにする */
const outline = (grid: Grid, isSolid: (ch: string) => boolean) => {
  const solid: boolean[][] = grid.map((row) => row.map(isSolid));
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (grid[y][x] !== '.') continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(nx, ny) && solid[ny][nx]) {
            touch = true;
            break;
          }
        }
      }
      if (touch) grid[y][x] = 'k';
    }
  }
};

/** 文字のピクセル座標（2 倍に太らせたもの）を列挙する */
const letterPixels = (): { x: number; y: number }[] => {
  const pixels: { x: number; y: number }[] = [];
  for (let i = 0; i < TEXT.length; i += 1) {
    const glyph = GLYPHS[TEXT[i]];
    if (glyph === undefined) {
      throw new Error(`CalandLogo: グリフがありません: "${TEXT[i]}"`);
    }
    const originX = LETTER_LEFT + i * (LETTER_W + LETTER_GAP);
    for (let row = 0; row < GLYPH_H; row += 1) {
      for (let col = 0; col < GLYPH_W; col += 1) {
        if (glyph[row][col] !== '#') continue;
        for (let sy = 0; sy < SCALE; sy += 1) {
          for (let sx = 0; sx < SCALE; sx += 1) {
            pixels.push({ x: originX + col * SCALE + sx, y: LETTER_TOP + row * SCALE + sy });
          }
        }
      }
    }
  }
  return pixels;
};

/** 文字の高さの何割目かで、紙 → 薄い金 → 金に塗り分ける */
const letterFill = (y: number): string => {
  const row = y - LETTER_TOP;
  if (row < 6) return 'p';
  if (row < 8) return 'h';
  return 'g';
};

const buildLogoGrid = (): Grid => {
  const grid = makeGrid();
  const left = LETTER_LEFT + 2;
  const right = LETTER_LEFT + TEXT_W - 3;

  // 島：草の天面 2 行、土 3 行、両端に砂浜
  fillRow(grid, ISLAND_TOP, left + 3, right - 3, 'L');
  fillRow(grid, ISLAND_TOP + 1, left + 1, right - 1, 'G');
  fillRow(grid, ISLAND_TOP + 1, left - 2, left, 'S');
  fillRow(grid, ISLAND_TOP + 1, right, right + 2, 'S');
  fillRow(grid, ISLAND_TOP + 2, left, right, 'D');
  fillRow(grid, ISLAND_TOP + 2, left - 3, left - 1, 'S');
  fillRow(grid, ISLAND_TOP + 2, right + 1, right + 3, 'S');
  fillRow(grid, ISLAND_TOP + 3, left + 2, right - 2, 'D');
  fillRow(grid, ISLAND_TOP + 4, left + 5, right - 5, 'd');
  outline(grid, (ch) => ch === 'L' || ch === 'G' || ch === 'D' || ch === 'd' || ch === 'S');

  // 波：島の下に 2 行、海と泡を 3:2 で交互に。2 行目は半ピッチずらす
  for (let x = 0; x < GRID_W; x += 1) {
    grid[ISLAND_TOP + 5][x] = x % 5 < 3 ? 'b' : 'w';
    grid[ISLAND_TOP + 6][x] = (x + 2) % 5 < 3 ? 'b' : 'w';
  }

  // 文字：影 → 輪郭 → 塗り の順に上から重ねる
  const pixels = letterPixels();
  const body = new Set(pixels.map(({ x, y }) => `${x},${y}`));
  const withOutline = new Set(body);
  for (const { x, y } of pixels) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        withOutline.add(`${x + dx},${y + dy}`);
      }
    }
  }
  for (const key of withOutline) {
    const [x, y] = key.split(',').map(Number);
    if (inBounds(x + SHADOW, y + SHADOW)) grid[y + SHADOW][x + SHADOW] = 'k';
  }
  for (const key of withOutline) {
    const [x, y] = key.split(',').map(Number);
    if (inBounds(x, y)) grid[y][x] = 'k';
  }
  for (const { x, y } of pixels) {
    grid[y][x] = letterFill(y);
  }
  return grid;
};

/** 横に続く同色のピクセルを 1 本の rect にまとめる */
const gridToRects = (grid: Grid): ReactElement[] => {
  const rects: ReactElement[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x += 1;
        continue;
      }
      const fill = PALETTE[ch];
      if (fill === undefined) {
        throw new Error(`CalandLogo: palette に "${ch}" がありません（${y} 行目）`);
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={fill} />);
      x = end;
    }
  });
  return rects;
};

const LOGO_RECTS = gridToRects(buildLogoGrid());

export interface CalandLogoProps {
  width?: number;
}

export const CalandLogo = ({ width = 420 }: CalandLogoProps) => (
  <svg
    role="img"
    aria-label="CALAND"
    width={width}
    height={Math.round((width * GRID_H) / GRID_W)}
    viewBox={`0 0 ${GRID_W} ${GRID_H}`}
    shapeRendering="crispEdges"
    style={{ maxWidth: '100%', height: 'auto' }}
  >
    {LOGO_RECTS}
  </svg>
);
