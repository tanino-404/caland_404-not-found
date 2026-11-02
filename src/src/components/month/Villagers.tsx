import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { TOWER_WIDTH, colToX, rowToZ, towerTopY } from '../../lib/camera';
import type { MonthCell } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import type { IslandTheme } from '../../types/ledger';
import { Voxel } from '../models/Voxel';

/** 町全体で出す村人の上限 */
const MAX_VILLAGERS = 60;
/** 塔の縁からどれだけ内側を歩くか */
const EDGE_INSET = 0.06;
/** 周回路（正方形）の半辺長 */
const HALF = TOWER_WIDTH / 2 - EDGE_INSET;
const SIDE = HALF * 2;
/** 周回路 1 周の長さ */
const LAP = SIDE * 4;

const SHIRT_COLORS = ['#e2564a', '#f2a23c', '#4aa3e2', '#63c07a', '#b07ae0', '#f2d24a'];
const LUXURY_SHIRT_COLORS = ['#ffd24a', '#fff4c2', '#e23d4f', '#7ec8e8', '#3ecf6e'];
const PANTS_COLORS = ['#3a4a6b', '#4b3a2c', '#2f5140', '#5a4668'];
const LUXURY_PANTS_COLORS = ['#5a3a10', '#3a2208', '#7a1d2e'];
const SKIN_COLOR = '#f0c39a';

/** 日付キーと番号から決まる 0〜1 の値（毎フレーム同じ結果になる決定的ハッシュ） */
const hash01 = (seed: string, salt: number): number => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

const villagerCountFor = (eventCount: number): number => {
  if (eventCount >= 6) return 3;
  if (eventCount >= 3) return 2;
  if (eventCount >= 1) return 1;
  return 0;
};

/** 周回路上の距離 d → 屋上ローカルの [x, z, 進行方向の rotation.y] */
const pathAt = (d: number): [number, number, number] => {
  const t = ((d % LAP) + LAP) % LAP;
  if (t < SIDE) return [-HALF + t, -HALF, Math.PI / 2];
  if (t < SIDE * 2) return [HALF, -HALF + (t - SIDE), 0];
  if (t < SIDE * 3) return [HALF - (t - SIDE * 2), HALF, -Math.PI / 2];
  return [-HALF, HALF - (t - SIDE * 3), Math.PI];
};

interface Villager {
  key: string;
  /** 屋上中心のワールド座標 */
  cx: number;
  cy: number;
  cz: number;
  /** 周回路上の開始位置 */
  offset: number;
  speed: number;
  /** 1 = 正回り / -1 = 逆回り */
  dir: number;
  phase: number;
  shirt: string;
  pants: string;
}

export interface VillagersProps {
  cells: MonthCell[];
  rows: number;
  byDate: Map<string, CalendarEvent[]>;
  theme: IslandTheme;
}

export const Villagers = ({ cells, rows, byDate, theme }: VillagersProps) => {
  const villagers = useMemo(() => {
    const shirts = theme === 'luxury' ? LUXURY_SHIRT_COLORS : SHIRT_COLORS;
    const pants = theme === 'luxury' ? LUXURY_PANTS_COLORS : PANTS_COLORS;
    const list: Villager[] = [];
    for (const cell of cells) {
      const eventCount = byDate.get(cell.dateKey)?.length ?? 0;
      const n = villagerCountFor(eventCount);
      if (n === 0) continue;
      const cx = colToX(cell.col);
      const cz = rowToZ(cell.row, rows);
      const cy = towerTopY(eventCount);
      for (let i = 0; i < n; i++) {
        if (list.length >= MAX_VILLAGERS) return list;
        const r0 = hash01(cell.dateKey, i * 4 + 1);
        const r1 = hash01(cell.dateKey, i * 4 + 2);
        const r2 = hash01(cell.dateKey, i * 4 + 3);
        const r3 = hash01(cell.dateKey, i * 4 + 4);
        list.push({
          key: `${cell.dateKey}-${i}`,
          cx,
          cy,
          cz,
          offset: (i / n) * LAP + r0 * (LAP / n),
          speed: 0.17 + r1 * 0.13,
          dir: r2 < 0.5 ? 1 : -1,
          phase: r3 * Math.PI * 2,
          shirt: shirts[Math.floor(r0 * shirts.length) % shirts.length],
          pants: pants[Math.floor(r1 * pants.length) % pants.length],
        });
      }
    }
    return list;
  }, [cells, rows, byDate, theme]);

  const roots = useRef<(Group | null)[]>([]);
  const legs = useRef<(Group | null)[]>([]);
  const arms = useRef<(Group | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < villagers.length; i++) {
      const v = villagers[i];
      const root = roots.current[i];
      if (!root) continue;
      const [px, pz, heading] = pathAt(v.offset + t * v.speed * v.dir);
      root.position.set(v.cx + px, v.cy, v.cz + pz);
      root.rotation.y = v.dir > 0 ? heading : heading + Math.PI;

      const swing = Math.sin(t * v.speed * 22 + v.phase) * 0.6;
      const legL = legs.current[i * 2];
      const legR = legs.current[i * 2 + 1];
      const armL = arms.current[i * 2];
      const armR = arms.current[i * 2 + 1];
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armL) armL.rotation.x = -swing;
      if (armR) armR.rotation.x = swing;
    }
  });

  return (
    <group>
      {villagers.map((v, i) => (
        <group
          key={v.key}
          ref={(el) => {
            roots.current[i] = el;
          }}
          position={[v.cx, v.cy, v.cz]}
        >
          <group
            position={[-0.009, 0.046, 0]}
            ref={(el) => {
              legs.current[i * 2] = el;
            }}
          >
            <Voxel x={0} y={-0.046} z={0} w={0.014} h={0.046} d={0.014} color={v.pants} />
          </group>
          <group
            position={[0.009, 0.046, 0]}
            ref={(el) => {
              legs.current[i * 2 + 1] = el;
            }}
          >
            <Voxel x={0} y={-0.046} z={0} w={0.014} h={0.046} d={0.014} color={v.pants} />
          </group>
          <Voxel x={0} y={0.046} z={0} w={0.032} h={0.04} d={0.02} color={v.shirt} />
          <group
            position={[-0.021, 0.084, 0]}
            ref={(el) => {
              arms.current[i * 2] = el;
            }}
          >
            <Voxel x={0} y={-0.036} z={0} w={0.01} h={0.036} d={0.01} color={v.shirt} />
          </group>
          <group
            position={[0.021, 0.084, 0]}
            ref={(el) => {
              arms.current[i * 2 + 1] = el;
            }}
          >
            <Voxel x={0} y={-0.036} z={0} w={0.01} h={0.036} d={0.01} color={v.shirt} />
          </group>
          <Voxel x={0} y={0.086} z={0} w={0.028} h={0.028} d={0.028} color={SKIN_COLOR} />
        </group>
      ))}
    </group>
  );
};
