import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PointLight } from 'three';
import type { DayPhase, IslandDecorProps } from '@plugin-sdk';
import { LuxuryLandmark } from './LuxuryLandmark';
import { LuxuryMarina } from './LuxuryMarina';
import { LuxurySky } from './LuxurySky';

/** 金の光の強さ。夜は強めて「光る島」に見せる */
const GOLD_BY_PHASE: Record<DayPhase, number> = { day: 1.6, evening: 1.9, night: 2.8 };
/** 約 1.2 秒で 95% 寄せる（画面のライトと同じ速さ） */
const LIGHT_RATE = 2.5;

export const GoldLights = ({ dayPhase }: { dayPhase: DayPhase }) => {
  const gold = useRef<PointLight>(null);
  useFrame((_, delta) => {
    const light = gold.current;
    if (!light) return;
    const target = GOLD_BY_PHASE[dayPhase];
    light.intensity += (target - light.intensity) * (1 - Math.exp(-delta * LIGHT_RATE));
  });
  return (
    <>
      <pointLight ref={gold} position={[0, 8, 0]} intensity={GOLD_BY_PHASE[dayPhase]} color="#ffd36a" distance={28} />
      <pointLight position={[4, 2.5, 5]} intensity={0.7} color="#7ee0ff" distance={16} />
    </>
  );
};

export const LuxuryDecor = ({ dayView, tallest }: IslandDecorProps) => (
  <>
    <LuxuryMarina />
    <LuxurySky />
    {tallest !== null && !dayView ? <LuxuryLandmark x={tallest.x} z={tallest.z} top={tallest.top} /> : null}
  </>
);
