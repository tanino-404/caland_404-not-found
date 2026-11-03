import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';

/**
 * ブロックの面に貼るドット絵テクスチャを描く（画像ファイルは使わない）。
 * 側面は 16×8（ブロックの縦横比 1:0.5）、天面は 16×16 で描く。
 * glowColors に入る色のピクセルだけを emissive 用の絵にも塗り、そこだけ光らせる。
 */

export type SetPixel = (x: number, y: number, color: string) => void;

export interface PixelTexture {
  map: CanvasTexture;
  glow: CanvasTexture;
}

/** 位置から決まる 0〜1（毎回同じ模様にする） */
export const noise = (x: number, y: number, salt: number): number => {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

export const paintPixels = (
  width: number,
  height: number,
  glowColors: ReadonlySet<string>,
  painter: (set: SetPixel) => void,
): PixelTexture => {
  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('pixelTexture: 2D コンテキストが取れません');
    }
    return { canvas, ctx };
  };
  const base = make();
  const glow = make();
  glow.ctx.fillStyle = '#000000';
  glow.ctx.fillRect(0, 0, width, height);
  painter((x, y, color) => {
    base.ctx.fillStyle = color;
    base.ctx.fillRect(x, y, 1, 1);
    if (glowColors.has(color)) {
      glow.ctx.fillStyle = color;
      glow.ctx.fillRect(x, y, 1, 1);
    }
  });
  const texture = (canvas: HTMLCanvasElement) => {
    const t = new CanvasTexture(canvas);
    t.magFilter = NearestFilter;
    t.minFilter = NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = SRGBColorSpace;
    return t;
  };
  return { map: texture(base.canvas), glow: texture(glow.canvas) };
};
