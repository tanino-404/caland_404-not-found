import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { BLOCK_HEIGHT, colToX, rowToZ, towerTopY } from '../../lib/camera';
import type { MonthCell } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import { Block } from '../models/blocks/Block';
import { blockKindForLevel } from '../models/blocks/blockKinds';
import { OBJECT_BY_CATEGORY } from '../models/objects';

/** 屋上 3×3 の配置順：中央 → 十字 → 四隅 */
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
const SLOT_PITCH = 0.29;
export const MAX_ROOFTOP_OBJECTS = SLOTS.length;

const RISE_SECONDS = 0.55;
const RISE_STAGGER = 0.025;

export interface DayTowerProps {
  cell: MonthCell;
  rows: number;
  events: CalendarEvent[];
  highlighted: boolean;
  onHover: (dateKey: string | null) => void;
  onSelect: (day: number) => void;
}

export const DayTower = ({ cell, rows, events, highlighted, onHover, onSelect }: DayTowerProps) => {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const count = events.length;
  const top = towerTopY(count);
  const levels = Array.from({ length: count + 1 }, (_, level) => level);
  const rooftop = events.slice(0, MAX_ROOFTOP_OBJECTS);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    elapsed.current += delta;
    const t = Math.min(1, Math.max(0, (elapsed.current - cell.day * RISE_STAGGER) / RISE_SECONDS));
    const eased = 1 - Math.pow(1 - t, 3);
    g.scale.y = 0.001 + eased * 0.999;
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(cell.dateKey);
  };
  const handleOut = () => {
    document.body.style.cursor = 'auto';
    onHover(null);
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(cell.day);
  };

  return (
    <group
      ref={group}
      position={[colToX(cell.col), 0, rowToZ(cell.row, rows)]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {levels.map((level) => (
        <Block key={level} level={level} kind={blockKindForLevel(level, level === count)} />
      ))}
      {rooftop.map((event, i) => {
        const Building = OBJECT_BY_CATEGORY[event.category];
        const [sx, sz] = SLOTS[i];
        return <Building key={event.id} position={[sx * SLOT_PITCH, top, sz * SLOT_PITCH]} />;
      })}
      {highlighted ? (
        <mesh position={[0, (top + BLOCK_HEIGHT) / 2, 0]}>
          <boxGeometry args={[1.02, top + BLOCK_HEIGHT + 0.02, 1.02]} />
          <meshBasicMaterial color="#ffc83d" transparent opacity={0.32} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
};
