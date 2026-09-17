import { Vector3 } from 'three';

export interface CameraPose {
  position: Vector3;
  target: Vector3;
}

export const CELL_SIZE = 1;
export const BLOCK_HEIGHT = 0.5;
export const TOWER_WIDTH = 1.0;

/** グリッドの列（0-6）→ ワールド x。中央寄せ。 */
export const colToX = (col: number): number => (col - 3) * CELL_SIZE;

/** グリッドの行 → ワールド z。中央寄せ。 */
export const rowToZ = (row: number, rows: number): number =>
  (row - (rows - 1) / 2) * CELL_SIZE;

/** 地面ブロック + 予定数ぶんのブロックを積んだときの天面の高さ */
export const towerTopY = (eventCount: number): number =>
  BLOCK_HEIGHT * (eventCount + 1);

/** tops: 各日の塔の天面高さ（towerTopY(count)）。cells と同じ順 */
export const monthCameraPose = (rows: number, tops: number[]): CameraPose => {
  const base = {
    position: new Vector3(3.6, 8.4 + rows * 0.85, rows / 2 + 7.8),
  };

  let weightedSum = 0;
  let blockCount = 0;
  for (const top of tops) {
    const n = Math.round(top / BLOCK_HEIGHT);
    for (let k = 0; k < n; k += 1) {
      weightedSum += BLOCK_HEIGHT * (k + 0.5);
    }
    blockCount += n;
  }
  const yCenter = blockCount > 0 ? weightedSum / blockCount : 0.25;
  const maxTop = Math.max(...tops, 0.5);

  const target = new Vector3(0, yCenter * 0.5 + maxTop * 0.35, -0.5);
  const position = new Vector3(
    3.6,
    base.position.y + maxTop * 0.8,
    base.position.z + maxTop * 0.3,
  );

  return { position, target };
};

/** ふたりの島モード：自分の島と相方の島の間の海の幅（セル数） */
export const PARTNER_SEA_GAP = 2.6;

/** 相方の島（グリッド全体）の z オフセット。自分の島の奥（-z）に海を挟んで置く */
export const partnerZOffset = (rows: number): number => -(rows * CELL_SIZE + PARTNER_SEA_GAP);

/**
 * ふたりの島モードの月俯瞰。両方の島と間の海が見えるよう、高く引いて見下ろす。
 * tops は両島すべての塔の天面高さ。高い塔があるぶんだけ少し引く
 */
export const monthSplitCameraPose = (rows: number, tops: number[]): CameraPose => {
  const maxTop = Math.max(...tops, 0.5);
  return {
    position: new Vector3(5.2, 17.5 + rows * 1.1 + maxTop * 0.5, rows / 2 + 12.5 + maxTop * 0.2),
    target: new Vector3(0, -0.6 + maxTop * 0.2, partnerZOffset(rows) / 2 + 0.6),
  };
};

export const dayCameraPose = (
  col: number,
  row: number,
  rows: number,
  eventCount: number,
): CameraPose => {
  const x = colToX(col);
  const z = rowToZ(row, rows);
  const top = towerTopY(eventCount);
  return {
    position: new Vector3(x + 0.85, top + 1.45, z + 1.25),
    target: new Vector3(x, top + 0.12, z),
  };
};

/** 海面 plane の高さ */
export const SEA_Y = -0.02;
/** 予定 0 の日に置く半透明の水ブロックの高さ */
export const WATER_HEIGHT = 0.12;
/** 水ブロックの中心 y（海面より少し上） */
export const WATER_CENTER_Y = WATER_HEIGHT / 2;
/** 水ブロックの天面 y */
export const WATER_TOP_Y = WATER_HEIGHT;
