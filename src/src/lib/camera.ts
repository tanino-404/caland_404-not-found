import { Vector3 } from 'three';

export interface CameraPose {
  position: Vector3;
  target: Vector3;
}

export const CELL_SIZE = 1;
export const BLOCK_HEIGHT = 0.5;
export const TOWER_WIDTH = 0.92;

/** グリッドの列（0-6）→ ワールド x。中央寄せ。 */
export const colToX = (col: number): number => (col - 3) * CELL_SIZE;

/** グリッドの行 → ワールド z。中央寄せ。 */
export const rowToZ = (row: number, rows: number): number =>
  (row - (rows - 1) / 2) * CELL_SIZE;

/** 地面ブロック + 予定数ぶんのブロックを積んだときの天面の高さ */
export const towerTopY = (eventCount: number): number =>
  BLOCK_HEIGHT * (eventCount + 1);

export const monthCameraPose = (rows: number): CameraPose => ({
  position: new Vector3(3.4, 8.8 + rows * 0.9, rows / 2 + 8.2),
  target: new Vector3(0, 0.3, -0.5),
});

/** ふたりの島モード：自分の島と相方の島の間の海の幅（セル数） */
export const PARTNER_SEA_GAP = 2.6;

/** 相方の島（グリッド全体）の z オフセット。自分の島の奥（-z）に海を挟んで置く */
export const partnerZOffset = (rows: number): number => -(rows * CELL_SIZE + PARTNER_SEA_GAP);

/** ふたりの島モードの月俯瞰。両方の島と間の海が見えるよう、高く引いて見下ろす */
export const monthSharedCameraPose = (rows: number): CameraPose => ({
  position: new Vector3(5.2, 17.5 + rows * 1.1, rows / 2 + 12.5),
  target: new Vector3(0, -0.6, partnerZOffset(rows) / 2 + 0.6),
});

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
