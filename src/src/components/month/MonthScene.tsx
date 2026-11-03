import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { type ComponentType, type ReactNode, useMemo, useRef } from 'react';
import type { Group } from 'three';
import {
  BLOCK_HEIGHT,
  type CameraPose,
  TOWER_WIDTH,
  WATER_TOP_Y,
  colToX,
  dayCameraPose,
  monthCameraPose,
  monthSplitCameraPose,
  partnerZOffset,
  rowToZ,
  towerTopY,
} from '../../lib/camera';
import { type MonthGrid, buildMonthGrid } from '../../lib/calendar';
import type { CalendarEvent, IslandLayout, ViewState } from '../../types/calendar';
import type { IslandTheme } from '../../types/ledger';
import { CameraRig } from './CameraRig';
import { DayTower } from './DayTower';
import { Flight } from './Flight';
import { type PixelLabel, PixelLabels } from './PixelLabels';
import { Sea } from './Sea';
import { Villagers } from './Villagers';
import { WeekdayHeader } from './WeekdayHeader';

export const HORIZON_COLOR = '#cfeeff';
export const LUXURY_HORIZON_COLOR = '#b8e8ff';

/** DayTower のせり上がり（RISE 0.55s + 31 日 × 0.025s）が終わるまでの待ち時間 */
const RISE_TOTAL_SECONDS = 1.6;

/** せり上がりが終わるまで中身を隠す。月切替で group の key ごと作り直される */
const AfterRise = ({ children }: { children: ReactNode }) => {
  const groupRef = useRef<Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || group.visible) return;
    elapsed.current += delta;
    if (elapsed.current >= RISE_TOTAL_SECONDS) group.visible = true;
  });

  return (
    <group ref={groupRef} visible={false}>
      {children}
    </group>
  );
};

/** ふたりの島モードで、相方の島に渡すデータ */
export interface PartnerIsland {
  name: string;
  /** 相方が所有者の予定 */
  byDate: Map<string, CalendarEvent[]>;
  /** 自分と相方の両方が所有者の予定がある日付。飛行機が行き来する */
  commonDates: Set<string>;
}

export interface MonthSceneProps {
  view: Extract<ViewState, { kind: 'month' | 'day' }>;
  /**
   * 手前の島に建てる予定。
   * merged なら全員の予定、split なら自分が所有者の予定
   */
  byDate: Map<string, CalendarEvent[]>;
  members: string[];
  layout: IslandLayout;
  /** split のときだけ渡す。奥の島 */
  partner: PartnerIsland | null;
  hoveredKey: string | null;
  onHover: (dateKey: string | null) => void;
  onSelectDay: (day: number) => void;
  theme: IslandTheme;
  /** 達成したプラグインのエフェクトが追加で置く 3D 部品（plugins/effects の部品表から） */
  EffectScene: ComponentType | null;
}

const NO_EVENTS: CalendarEvent[] = [];

const buildDayLabels = (
  grid: MonthGrid,
  byDate: Map<string, CalendarEvent[]>,
  theme: IslandTheme,
): PixelLabel[] =>
  grid.cells.map((cell) => {
    const count = byDate.get(cell.dateKey)?.length ?? 0;
    if (count === 0) {
      // 海の日は水面に寝かせて置く（立てると水中に沈んで読めないため）
      return {
        text: String(cell.day),
        position: [colToX(cell.col), WATER_TOP_Y + 0.05, rowToZ(cell.row, grid.rows)],
        rotation: [-Math.PI / 2, 0, 0],
        color: '#1b2a41',
        pitch: 0.055,
      };
    }
    return {
      text: String(cell.day),
      position: [
        colToX(cell.col),
        towerTopY(count) - BLOCK_HEIGHT / 2,
        rowToZ(cell.row, grid.rows) + TOWER_WIDTH / 2 + 0.012,
      ],
      rotation: [0, 0, 0],
      color: theme === 'luxury' ? '#3a2208' : count >= 6 ? '#1b2a41' : '#fff6dc',
      pitch: 0.055,
    };
  });

const towerTops = (grid: MonthGrid, byDate: Map<string, CalendarEvent[]>): number[] =>
  grid.cells.map((cell) => towerTopY(byDate.get(cell.dateKey)?.length ?? 0));

interface FlightSpec {
  dateKey: string;
  x: number;
  z0: number;
  y0: number;
  z1: number;
  y1: number;
  apexY: number;
  phase: number;
}

export const MonthScene = ({
  view,
  byDate,
  members,
  layout,
  partner,
  hoveredKey,
  onHover,
  onSelectDay,
  theme,
  EffectScene,
}: MonthSceneProps) => {
  const { year, month } = view;
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const split = layout === 'split' && partner !== null;
  const partnerByDate = split ? partner.byDate : null;

  const selectedDay = view.kind === 'day' ? view.day : null;

  const pose: CameraPose = useMemo(() => {
    if (view.kind === 'day') {
      const cell = grid.cells[view.day - 1];
      const count = byDate.get(cell.dateKey)?.length ?? 0;
      return dayCameraPose(cell.col, cell.row, grid.rows, count);
    }
    const tops = towerTops(grid, byDate);
    if (partnerByDate) {
      return monthSplitCameraPose(grid.rows, [...tops, ...towerTops(grid, partnerByDate)]);
    }
    return monthCameraPose(grid.rows, tops);
  }, [view, grid, byDate, partnerByDate]);

  const dayLabels = useMemo(() => buildDayLabels(grid, byDate, theme), [grid, byDate, theme]);
  const partnerDayLabels = useMemo(
    () => (partnerByDate ? buildDayLabels(grid, partnerByDate, theme) : []),
    [grid, partnerByDate, theme],
  );
  const horizon = theme === 'luxury' ? LUXURY_HORIZON_COLOR : HORIZON_COLOR;

  const flights: FlightSpec[] = useMemo(() => {
    if (!split) return [];
    const zOff = partnerZOffset(grid.rows);
    // 飛行軌道が同じ列のタワーを貫通しないよう、列ごとの最大高さを取る（屋上の建物ぶんは余白 1.35 で吸収）
    const colMaxTop = Array.from({ length: 7 }, () => BLOCK_HEIGHT);
    for (const cell of grid.cells) {
      const mine = towerTopY(byDate.get(cell.dateKey)?.length ?? 0);
      const theirs = towerTopY(partner.byDate.get(cell.dateKey)?.length ?? 0);
      colMaxTop[cell.col] = Math.max(colMaxTop[cell.col], mine, theirs);
    }
    return grid.cells
      .filter((cell) => partner.commonDates.has(cell.dateKey))
      .map((cell) => {
        const z0 = rowToZ(cell.row, grid.rows);
        return {
          dateKey: cell.dateKey,
          x: colToX(cell.col),
          z0,
          y0: towerTopY(byDate.get(cell.dateKey)?.length ?? 0),
          z1: z0 + zOff,
          y1: towerTopY(partner.byDate.get(cell.dateKey)?.length ?? 0),
          apexY: colMaxTop[cell.col] + 1.35,
          phase: cell.day * 0.9,
        };
      });
  }, [split, grid, byDate, partner]);

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMappingExposure: theme === 'luxury' ? 1.12 : 0.95 }}
        camera={{ position: [3.2, 11, 11.5], fov: 40, near: 0.1, far: 120 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.2, 0);
        }}
        onPointerMissed={() => onHover(null)}
      >
        <fog
          key={`${theme}-${split ? 'wide' : 'near'}`}
          attach="fog"
          args={[horizon, split ? 26 : 18, split ? 62 : 48]}
        />
        <ambientLight intensity={theme === 'luxury' ? 0.78 : 0.55} color="#fff8ee" />
        <hemisphereLight
          args={theme === 'luxury' ? ['#c8f0ff', '#f0d9a0', 1.15] : ['#dff3ff', '#c9b48a', 0.9]}
        />
        <directionalLight
          position={[6, 12, 4]}
          intensity={theme === 'luxury' ? 1.55 : 1.1}
          color={theme === 'luxury' ? '#fff5d6' : '#fff1d6'}
        />
        {theme === 'luxury' ? (
          <>
            <pointLight position={[0, 8, 0]} intensity={1.6} color="#ffd36a" distance={28} />
            <pointLight position={[4, 2.5, 5]} intensity={0.7} color="#7ee0ff" distance={16} />
          </>
        ) : null}

        <Sea theme={theme} />

        <group key={`${year}-${month}-${layout}-${theme}`}>
          <WeekdayHeader rows={grid.rows} />
          {grid.cells.map((cell) => (
            <DayTower
              key={cell.dateKey}
              cell={cell}
              rows={grid.rows}
              events={byDate.get(cell.dateKey) ?? NO_EVENTS}
              members={members}
              highlighted={hoveredKey === cell.dateKey || selectedDay === cell.day}
              onHover={onHover}
              onSelect={onSelectDay}
              theme={theme}
            />
          ))}
          {EffectScene !== null ? <EffectScene /> : null}
          <AfterRise>
            <Villagers cells={grid.cells} rows={grid.rows} byDate={byDate} theme={theme} />
            <PixelLabels labels={dayLabels} />
          </AfterRise>

          {split ? (
            <group position={[0, 0, partnerZOffset(grid.rows)]}>
              {grid.cells.map((cell) => (
                <DayTower
                  key={`partner-${cell.dateKey}`}
                  cell={cell}
                  rows={grid.rows}
                  events={partner.byDate.get(cell.dateKey) ?? NO_EVENTS}
                  members={members}
                  highlighted={false}
                  theme={theme}
                />
              ))}
              <AfterRise>
                <Villagers cells={grid.cells} rows={grid.rows} byDate={partner.byDate} theme={theme} />
                <PixelLabels labels={partnerDayLabels} />
              </AfterRise>
            </group>
          ) : null}
          {flights.map((flight) => (
            <Flight
              key={flight.dateKey}
              x={flight.x}
              z0={flight.z0}
              y0={flight.y0}
              z1={flight.z1}
              y1={flight.y1}
              apexY={flight.apexY}
              phase={flight.phase}
            />
          ))}
        </group>

        <CameraRig pose={pose} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.08}
          minDistance={1.2}
          maxDistance={38}
        />
      </Canvas>
      <div className="scene-tilt" aria-hidden="true" />
    </>
  );
};
