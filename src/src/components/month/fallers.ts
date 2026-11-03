/** 空から降らせるもの（PixelRain）の配置。島の上の空間に決まった乱数で散らす */

export interface Faller {
  x: number;
  z: number;
  top: number;
  fall: number;
  speed: number;
  size: number;
  phase: number;
}

export const unit = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** 島の上の空間に散らす。foreground はカメラの手前で大きく見えるもの */
export const buildFallers = (count: number, salt: number, pixel: number, foreground: boolean): Faller[] =>
  Array.from({ length: count }, (_, i) => {
    const near = foreground;
    // 手前の大きなものは町を隠さないよう、画面の左右の端だけに置く
    const side = i % 2 === 0 ? -1 : 1;
    return {
      x: near ? side * (4.2 + unit(i, salt) * 3.2) : (unit(i, salt) - 0.5) * 17,
      z: near ? 4.5 + unit(i, salt + 1) * 3.5 : (unit(i, salt + 1) - 0.5) * 14,
      top: near ? 10 : 8.5,
      fall: near ? 7 : 9.5,
      speed: 0.05 + unit(i, salt + 2) * 0.05,
      size: pixel * (near ? 1.6 + unit(i, salt + 3) * 0.5 : 0.75 + unit(i, salt + 3) * 0.45),
      phase: unit(i, salt + 4),
    };
  });

