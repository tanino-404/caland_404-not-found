/**
 * 3x5 ピクセルフォント。'#' が点灯。上の行から順に並べる。
 * 日付数字と曜日ラベル（SUN..SAT）に必要な文字だけ持つ。
 */
const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  S: ['###', '#..', '###', '..#', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  N: ['#.#', '###', '###', '#.#', '#.#'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  E: ['###', '#..', '###', '#..', '###'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  F: ['###', '#..', '###', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  A: ['###', '#.#', '###', '#.#', '#.#'],
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;
export const GLYPH_GAP = 1;

export interface Pixel {
  /** 左からの列 */
  x: number;
  /** 下からの行 */
  y: number;
}

export const textWidthInPixels = (text: string): number =>
  text.length * GLYPH_W + (text.length - 1) * GLYPH_GAP;

export const textToPixels = (text: string): Pixel[] => {
  const pixels: Pixel[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const glyph = GLYPHS[ch];
    if (!glyph) {
      throw new Error(`pixelFont: glyph not defined for "${ch}" in "${text}"`);
    }
    const originX = i * (GLYPH_W + GLYPH_GAP);
    for (let row = 0; row < GLYPH_H; row++) {
      const line = glyph[row];
      for (let col = 0; col < GLYPH_W; col++) {
        if (line[col] === '#') {
          pixels.push({ x: originX + col, y: GLYPH_H - 1 - row });
        }
      }
    }
  }
  return pixels;
};
