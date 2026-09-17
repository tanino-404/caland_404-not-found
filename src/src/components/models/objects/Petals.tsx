import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { UNIT_BOX, materialFor } from '../materials';

const PETAL_COUNT = 12;
const PETAL_SIZE = 0.022;
const FALL_HEIGHT = 0.55;
const RADIUS = 0.16;
const COLORS = ['#ffb7c5', '#fff0f5', '#ff9fb8'];

interface PetalSeed {
  phase: number;
  angle: number;
  speed: number;
  color: string;
}

const SEEDS: PetalSeed[] = Array.from({ length: PETAL_COUNT }, (_, i) => ({
  phase: i / PETAL_COUNT,
  angle: (i * 2.399) % (Math.PI * 2),
  speed: 0.18 + (i % 3) * 0.04,
  color: COLORS[i % COLORS.length],
}));

export interface PetalsProps {
  /** 花びらが舞い始める高さ（建物の頂上あたり） */
  top: number;
}

/** 頂上からゆっくり舞い落ちる花びら。結婚式の建物の上に置く。 */
export const Petals = ({ top }: PetalsProps) => {
  const group = useRef<Group>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    time.current += delta;
    const t = time.current;
    g.children.forEach((petal, i) => {
      const seed = SEEDS[i];
      const progress = (t * seed.speed + seed.phase) % 1;
      const angle = seed.angle + t * 0.9 + progress * 2.5;
      const r = RADIUS * (0.4 + progress * 0.6);
      petal.position.set(
        Math.cos(angle) * r,
        top + FALL_HEIGHT * (1 - progress),
        Math.sin(angle) * r,
      );
      petal.rotation.set(t * 3 + i, t * 2, progress * 4);
    });
  });

  return (
    <group ref={group}>
      {SEEDS.map((seed, i) => (
        <mesh
          key={i}
          geometry={UNIT_BOX}
          material={materialFor(seed.color)}
          scale={[PETAL_SIZE, PETAL_SIZE * 0.5, PETAL_SIZE * 1.4]}
        />
      ))}
    </group>
  );
};
