import { Vector3 } from 'three';
import type { CameraPose } from '../../lib/camera';

/** 年ビューの島の並び：横 4 列 × 縦 3 段。左上が 1 月 */
export const YEAR_COLS = 4;
export const YEAR_ROWS = 3;

/** 島と島の間隔（島は 7 マス幅、最大 6 行）。島 + 海 3 マス */
export const ISLAND_PITCH_X = 10;
export const ISLAND_PITCH_Z = 9;

/** 年と年の間隔（左右スクロール用）。12 島の幅 37 + 海 19 */
export const YEAR_PITCH = 56;

/** 12 島全体の幅と奥行き（島の縁まで） */
export const YEAR_WIDTH = ISLAND_PITCH_X * (YEAR_COLS - 1) + 7;
export const YEAR_DEPTH = ISLAND_PITCH_Z * (YEAR_ROWS - 1) + 6;

/** month（1-12）の島の中心。12 島のグリッド全体を原点中心に置く */
export const islandCenter = (month: number): { x: number; z: number } => {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`islandCenter: month は 1〜12 の整数です: ${month}`);
  }
  const col = (month - 1) % YEAR_COLS;
  const row = Math.floor((month - 1) / YEAR_COLS);
  return {
    x: (col - (YEAR_COLS - 1) / 2) * ISLAND_PITCH_X,
    z: (row - (YEAR_ROWS - 1) / 2) * ISLAND_PITCH_Z,
  };
};

/**
 * 12 島全体を見下ろす俯瞰。斜め上から、fov 40 の横長画面で全島が入る高さ・距離。
 * 注視点は少し奥に寄せ、手前の月ラベルも画面に入れる
 */
export const yearOverviewPose = (): CameraPose => ({
  position: new Vector3(2, 40, 35),
  target: new Vector3(0, -2, 1),
});

/**
 * 1 島への寄り。月ビュー（monthCameraPose）とほぼ同じ構図を、その島の中心へ平行移動したもの。
 * 年→月のクローズアップ、月→年のクローズアウトの起点に使う
 */
export const yearIslandClosePose = (month: number): CameraPose => {
  const { x, z } = islandCenter(month);
  return {
    position: new Vector3(x + 3.6, 12.4, z + 10.6),
    target: new Vector3(x, 1.1, z - 0.5),
  };
};
