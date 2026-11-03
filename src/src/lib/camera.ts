import { Vector3 } from 'three';
import type { CalendarEvent } from '../types/calendar';
import { buildMonthGrid } from './calendar';

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

/**
 * 友達の島モード：ふたりの予定の日に、塔から奥（-z）へ飛行機が飛んでいく距離。
 * 自分の島は表示しないので画面外へ消える見せ方にする。fog の far（48）より手前
 */
export const FRIEND_FLIGHT_DISTANCE = 20;

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

/** 月カルーセルで隣の月の島を置く x の間隔。島の幅 7 + 黄金郷のヨット・浮島（±6.6）が重ならない値 */
/** 隣の月の島までの距離。霧（near 18〜far 44）の中に入り、カメラを回しても靄の向こうにうっすら見える程度 */
export const MONTH_PITCH = 32;

/** cells と同じ順で、各日の塔の天面高さ（towerTopY(count)）を並べる */
export const monthTowerTops = (
  year: number,
  month: number,
  byDate: Map<string, CalendarEvent[]>,
): { rows: number; tops: number[] } => {
  const grid = buildMonthGrid(year, month);
  return {
    rows: grid.rows,
    tops: grid.cells.map((cell) => towerTopY(byDate.get(cell.dateKey)?.length ?? 0)),
  };
};

/**
 * 月俯瞰（selectedDay が null）または日ズーム（selectedDay がその日）の姿勢。
 * 既存の monthCameraPose / dayCameraPose を byDate から組み立てる
 */
export const computeMonthPose = (
  year: number,
  month: number,
  byDate: Map<string, CalendarEvent[]>,
  selectedDay: number | null,
): CameraPose => {
  const grid = buildMonthGrid(year, month);
  if (selectedDay !== null) {
    const cell = grid.cells[selectedDay - 1];
    if (cell === undefined) {
      throw new Error(`computeMonthPose: ${year}-${month} に ${selectedDay} 日はありません`);
    }
    const count = byDate.get(cell.dateKey)?.length ?? 0;
    return dayCameraPose(cell.col, cell.row, grid.rows, count);
  }
  const tops = grid.cells.map((cell) => towerTopY(byDate.get(cell.dateKey)?.length ?? 0));
  return monthCameraPose(grid.rows, tops);
};

/** 月→年のクローズアウトで引き始める高さ。年→月のクローズアップはここへ降りてくる */
const PULL_OUT_HEIGHT = 22;

/**
 * 月→年のクローズアウト起点／年→月のクローズアップ終点。
 * 島の真上・高めから見下ろす。真上（極）だと OrbitControls の up と揃って回転が壊れるので少し手前へずらす
 */
export const monthPullOutPose = (
  year: number,
  month: number,
  byDate: Map<string, CalendarEvent[]>,
): CameraPose => {
  const { rows, tops } = monthTowerTops(year, month, byDate);
  const maxTop = Math.max(...tops, 0.5);
  return {
    position: new Vector3(0.6, PULL_OUT_HEIGHT + maxTop * 0.4, rows / 2 + 4.5),
    target: new Vector3(0, maxTop * 0.3, -0.5),
  };
};

/** タイトル（ログイン）画面のカメラ姿勢。飾り島の斜め上、少し低めで横顔が見える */
export const TITLE_POSE: CameraPose = {
  position: new Vector3(11.5, 8.5, 14.5),
  target: new Vector3(0, 1.2, -0.5),
};
