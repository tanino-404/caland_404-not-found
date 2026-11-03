import { useFrame } from '@react-three/fiber';
import { type RefObject, useRef } from 'react';
import type { Group } from 'three';

/** 達成した島の空の演出（SkyFx.tsx）を、達成した月に入る / 出るときに 1 秒かけて出し入れする */

/** LuxuryFx / MuscleFx の props */
export interface SkyFxProps {
  /** 達成している月か。切り替えで 1 秒かけてフェードイン・アウトする */
  active: boolean;
  /** 画面全体に出るレンズフレアを付けるか。カルーセルの中央の島だけ true */
  flare: boolean;
}

/** 全体のフェードイン・アウトにかける秒数 */
const FADE_SECONDS = 1.0;
/** 1 個ずつ：上端で現れきるまでの帯と、下端で消えはじめる帯（落下の進み 0〜1 に対する割合） */
export const APPEAR_BAND = 0.22;
export const VANISH_BAND = 0.28;

/**
 * active の切り替えで 0 ↔ 1 を FADE_SECONDS かけて動かす。0 の間は group を描かない。
 * 共有の材質を汚さないよう、透明度ではなく大きさで現れ・消える
 */
export const useSkyFade = (active: boolean): { fade: RefObject<number>; group: RefObject<Group | null> } => {
  const fade = useRef(0);
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const step = delta / FADE_SECONDS;
    fade.current = Math.min(1, Math.max(0, fade.current + (active ? step : -step)));
    if (group.current) group.current.visible = fade.current > 0;
  });
  return { fade, group };
};
