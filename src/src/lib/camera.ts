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
