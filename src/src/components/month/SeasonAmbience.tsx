import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { colToX, partnerZOffset, rowToZ } from '../../lib/camera';
import type { SeasonEffect } from '../../lib/season';
import { UNIT_BOX, materialFor } from '../models/materials';
import { HEADER_OFFSET_Z } from './WeekdayHeader';

interface ParticleSeed {
  phase: number;
  x0: number;
  z0: number;
  drift: number;
  speed: number;
  spin: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
}

const countFor = (effect: SeasonEffect): number => {
  switch (effect) {
    case 'sakura':
      return 96;
    case 'autumn':
      return 88;
    case 'snow':
      return 72;
    case 'rain':
      return 80;
    case 'fresh':
      return 48;
    default:
      return 0;
  }
};

/** 桜＝ピンクの薄い花びら。紅葉＝赤橙の細長い葉。色域を完全に分ける */
const buildSeeds = (
  effect: SeasonEffect,
  spanX: number,
  spanZ: number,
  zCenter: number,
): ParticleSeed[] => {
  const count = countFor(effect);
  if (count === 0) return [];

  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const base = {
      phase: t,
      x0: (t * 2.399 % 1) * spanX - spanX / 2,
      z0: zCenter + ((i * 0.618) % 1) * spanZ - spanZ / 2,
      spin: (i * 1.7) % (Math.PI * 2),
    };

    if (effect === 'sakura') {
      const pinks = ['#ff8eb8', '#ffb8d0', '#ffc8dc', '#fff0f8'];
      return {
        ...base,
        drift: 0.22 + (i % 4) * 0.05,
        speed: 0.08 + (i % 5) * 0.012,
        sx: 0.055 + (i % 3) * 0.012,
        sy: 0.006,
        sz: 0.038 + (i % 4) * 0.01,
        color: pinks[i % pinks.length],
      };
    }

    if (effect === 'autumn') {
      const warm = ['#c02818', '#e03810', '#d86808', '#a83808', '#8b2808'];
      return {
        ...base,
        drift: 0.12 + (i % 4) * 0.03,
        speed: 0.14 + (i % 5) * 0.018,
        sx: 0.048 + (i % 3) * 0.01,
        sy: 0.008,
        sz: 0.022 + (i % 4) * 0.008,
        color: warm[i % warm.length],
      };
    }

    if (effect === 'snow') {
      const whites = ['#f4f8ff', '#eef4ff', '#ffffff'];
      return {
        ...base,
        drift: 0.15 + (i % 5) * 0.04,
        speed: 0.12 + (i % 6) * 0.025,
        sx: 0.028 + (i % 3) * 0.008,
        sy: 0.028,
        sz: 0.028 + (i % 3) * 0.008,
        color: whites[i % whites.length],
      };
    }

    if (effect === 'rain') {
      const blues = ['#a8c8e8', '#88b0d8', '#c0d8f0'];
      return {
        ...base,
        drift: 0,
        speed: 1.4 + (i % 4) * 0.15,
        sx: 0.012,
        sy: 0.14 + (i % 3) * 0.04,
        sz: 0.012,
        color: blues[i % blues.length],
      };
    }

    const greens = ['#b8f0a0', '#88d868', '#fff8e0'];
    return {
      ...base,
      drift: 0.1 + (i % 4) * 0.03,
      speed: 0.1 + (i % 4) * 0.015,
      sx: 0.02,
      sy: 0.02,
      sz: 0.02,
      color: greens[i % greens.length],
    };
  });
};

export interface SeasonAmbienceProps {
  rows: number;
  effect: SeasonEffect;
  split: boolean;
}

/** 島全体を覆う季節パーティクル。`clear` の月は何も降らない */
export const SeasonAmbience = ({ rows, effect, split }: SeasonAmbienceProps) => {
  const group = useRef<Group>(null);
  const time = useRef(0);

  const { seeds, yTop, yBase } = useMemo(() => {
    const minX = colToX(0) - 0.8;
    const maxX = colToX(6) + 0.8;
    const zNear = rowToZ(0, rows) + HEADER_OFFSET_Z - 0.5;
    const zFar = rowToZ(rows - 1, rows) + 0.8;
    const zOff = split ? partnerZOffset(rows) : 0;
    const zMin = split ? zOff - 0.8 : zFar;
    const zMax = zNear;
    const spanX = maxX - minX;
    const spanZ = zMax - zMin;
    const zCenter = (zMax + zMin) / 2;
    return {
      seeds: buildSeeds(effect, spanX, spanZ, zCenter),
      yTop: effect === 'rain' ? 9.5 : 8.5,
      yBase: effect === 'rain' ? 0.2 : -0.2,
    };
  }, [rows, effect, split]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    time.current += delta;
    const t = time.current;

    g.children.forEach((mesh, i) => {
      const seed = seeds[i];
      if (!seed) return;
      const progress = (t * seed.speed + seed.phase) % 1;
      const y = yTop - (yTop - yBase) * progress;
      const sway =
        effect === 'rain'
          ? 0
          : Math.sin(t * (effect === 'sakura' ? 1.0 : 1.4) + seed.spin) *
            seed.drift *
            (effect === 'sakura' ? 0.7 + progress : 0.35 + progress);
      mesh.position.set(
        seed.x0 + sway,
        y,
        seed.z0 + Math.cos(t * 0.8 + seed.phase) * seed.drift * 0.5,
      );
      if (effect === 'autumn') {
        mesh.rotation.set(progress * 5 + seed.spin, t * 1.2, progress * 8);
      } else if (effect === 'sakura') {
        mesh.rotation.set(t * 1.5 + seed.spin, progress * 2, t * 2);
      } else if (effect === 'rain') {
        mesh.rotation.set(0, 0, 0);
      } else {
        mesh.rotation.set(t * 2 + seed.spin, t * 1.5, progress * 3);
      }
    });
  });

  if (seeds.length === 0) return null;

  return (
    <group ref={group}>
      {seeds.map((seed, i) => (
        <mesh
          key={i}
          geometry={UNIT_BOX}
          material={materialFor(seed.color)}
          scale={[seed.sx, seed.sy, seed.sz]}
        />
      ))}
    </group>
  );
};
