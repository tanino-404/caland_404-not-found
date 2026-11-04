import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import {
  BLOCK_HEIGHT,
  TOWER_WIDTH,
  WATER_CENTER_Y,
  WATER_HEIGHT,
  colToX,
  rowToZ,
  towerTopY,
} from '../../lib/camera';
import type { MonthCell } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import type { Island } from '../../types/island';
import { Block } from '../models/blocks/Block';
import { BLOCK_COLORS } from '../models/blocks/blockKinds';
import { blockMaterialFor } from '../models/blocks/blockMaterials';
import { OBJECT_BY_CATEGORY } from '../models/objects';
import { OwnerPlate, PLATE_HEIGHT } from '../models/OwnerPlate';

/** 屋上 3×3 のスロット座標（配置順は日付ごとにシャッフルする） */
const SLOTS: [number, number][] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [1, 0],
  [-1, 0],
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];
const SLOT_PITCH = 0.31;
export const MAX_ROOFTOP_OBJECTS = SLOTS.length;
/** ずれの最大量。objects/index.ts の pickVariant は position/0.29 を round するため、
 * SLOT_PITCH の半分（0.145）を大きく下回る値に抑えてバリエーション選択を壊さない。 */
const JITTER_MAX = 0.03;

/** 決定的な疑似乱数生成器（mulberry32） */
const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

/** 日付文字列から決定的なシードを作る */
const seedFromDateKey = (dateKey: string): number => {
  let sum = 0;
  for (let i = 0; i < dateKey.length; i += 1) sum += dateKey.charCodeAt(i);
  return sum;
};

/** 日付ごとに決定的にシャッフルした屋上スロット配置（座標 + jitter）を作る */
const buildRooftopLayout = (dateKey: string): { slot: [number, number]; jitter: [number, number] }[] => {
  const rng = mulberry32(seedFromDateKey(dateKey));
  const shuffled = [...SLOTS];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((slot) => ({
    slot,
    jitter: [(rng() * 2 - 1) * JITTER_MAX, (rng() * 2 - 1) * JITTER_MAX],
  }));
};

const RISE_SECONDS = 0.55;
const RISE_STAGGER = 0.025;

/** 水面の揺れ */
const WAVE_AMPLITUDE = 0.02;
const WAVE_SPEED = 1.1;

export interface DayTowerProps {
  cell: MonthCell;
  rows: number;
  events: CalendarEvent[];
  members: string[];
  /** ホバー中または日ビューで選択中。建物が浮き、足元に所有者色の台座が出る */
  highlighted: boolean;
  /** 省略すると操作できない飾りの塔になる（相方の島用） */
  onHover?: (dateKey: string | null) => void;
  onSelect?: (day: number) => void;
  /** 目標を達成して変わった島。いつもの島は null */
  island: Island | null;
}

const PLAIN_WATER = { color: BLOCK_COLORS.water, roughness: 0.25, metalness: 0.1, opacity: 0.55 };

export const DayTower = ({
  cell,
  rows,
  events,
  members,
  highlighted,
  onHover,
  onSelect,
  island,
}: DayTowerProps) => {
  const group = useRef<Group>(null);
  const water = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const count = events.length;
  const isSea = count === 0;
  const top = towerTopY(count);
  const levels = isSea ? [] : Array.from({ length: count + 1 }, (_, level) => level);
  const rooftop = events.slice(0, MAX_ROOFTOP_OBJECTS);
  const rooftopLayout = buildRooftopLayout(cell.dateKey);
  const wavePhase = (cell.col * 1.7 + cell.row * 2.3) % (Math.PI * 2);
  const waterLook = island?.water ?? PLAIN_WATER;
  const Rooftop = island?.Rooftop;

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    elapsed.current += delta;
    const t = Math.min(1, Math.max(0, (elapsed.current - cell.day * RISE_STAGGER) / RISE_SECONDS));
    const eased = 1 - Math.pow(1 - t, 3);
    g.scale.y = 0.001 + eased * 0.999;
    const w = water.current;
    if (w) {
      w.position.y =
        WATER_CENTER_Y + Math.sin(elapsed.current * WAVE_SPEED + wavePhase) * WAVE_AMPLITUDE;
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover?.(cell.dateKey);
  };
  const handleOut = () => {
    document.body.style.cursor = 'auto';
    onHover?.(null);
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(cell.day);
  };

  const highlightHeight = isSea ? WATER_HEIGHT + 0.02 : top + BLOCK_HEIGHT + 0.02;

  return (
    <group
      ref={group}
      position={[colToX(cell.col), 0, rowToZ(cell.row, rows)]}
      onPointerOver={onHover ? handleOver : undefined}
      onPointerOut={onHover ? handleOut : undefined}
      onClick={onSelect ? handleClick : undefined}
    >
      {isSea ? (
        <mesh ref={water} position={[0, WATER_CENTER_Y, 0]}>
          <boxGeometry args={[TOWER_WIDTH, WATER_HEIGHT, TOWER_WIDTH]} />
          <meshStandardMaterial
            color={waterLook.color}
            roughness={waterLook.roughness}
            metalness={waterLook.metalness}
            transparent
            opacity={waterLook.opacity}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {levels.map((level) => (
        <Block key={level} level={level} material={blockMaterialFor(level, level === count, island)} />
      ))}
      {Rooftop !== undefined && !isSea ? <Rooftop dateKey={cell.dateKey} count={count} y={top} /> : null}
      {rooftop.map((event, i) => {
        const Building = OBJECT_BY_CATEGORY[event.category];
        const { slot, jitter } = rooftopLayout[i];
        const [sx, sz] = slot;
        const [jx, jz] = jitter;
        const x = sx * SLOT_PITCH + jx;
        const z = sz * SLOT_PITCH + jz;
        return (
          <group key={event.id}>
            {highlighted ? (
              <OwnerPlate owners={event.owners} members={members} position={[x, top, z]} />
            ) : null}
            <Building position={[x, highlighted ? top + PLATE_HEIGHT : top, z]} />
          </group>
        );
      })}
      {highlighted ? (
        <mesh position={[0, highlightHeight / 2, 0]}>
          <boxGeometry args={[1.02, highlightHeight, 1.02]} />
          {/* 所有者の台座を見やすくするため薄めにしている */}
          <meshBasicMaterial color="#ffc83d" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
};
