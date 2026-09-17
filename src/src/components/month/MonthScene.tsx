import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import type { Group } from 'three';
import {
  BLOCK_HEIGHT,
  type CameraPose,
  TOWER_WIDTH,
  WATER_TOP_Y,
  colToX,
  dayCameraPose,
  monthCameraPose,
  rowToZ,
  towerTopY,
} from '../../lib/camera';
import { buildMonthGrid } from '../../lib/calendar';
import type { CalendarEvent, ViewState } from '../../types/calendar';
import { CameraRig } from './CameraRig';
import { DayTower } from './DayTower';
import { type PixelLabel, PixelLabels } from './PixelLabels';
import { Sea } from './Sea';
import { Villagers } from './Villagers';
import { WeekdayHeader } from './WeekdayHeader';

export const HORIZON_COLOR = '#cfeeff';

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

export interface MonthSceneProps {
  view: Extract<ViewState, { kind: 'month' | 'day' }>;
  byDate: Map<string, CalendarEvent[]>;
  hoveredKey: string | null;
  onHover: (dateKey: string | null) => void;
  onSelectDay: (day: number) => void;
}

const NO_EVENTS: CalendarEvent[] = [];

export const MonthScene = ({ view, byDate, hoveredKey, onHover, onSelectDay }: MonthSceneProps) => {
  const { year, month } = view;
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const selectedDay = view.kind === 'day' ? view.day : null;

  const pose: CameraPose = useMemo(() => {
    if (view.kind === 'day') {
      const cell = grid.cells[view.day - 1];
      const count = byDate.get(cell.dateKey)?.length ?? 0;
      return dayCameraPose(cell.col, cell.row, grid.rows, count);
    }
    const tops = grid.cells.map((cell) => towerTopY(byDate.get(cell.dateKey)?.length ?? 0));
    return monthCameraPose(grid.rows, tops);
  }, [view, grid, byDate]);

  const dayLabels: PixelLabel[] = useMemo(
    () =>
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
          color: count >= 6 ? '#1b2a41' : '#fff6dc',
          pitch: 0.055,
        };
      }),
    [grid, byDate],
  );

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMappingExposure: 0.95 }}
        camera={{ position: [3.2, 11, 11.5], fov: 40, near: 0.1, far: 120 }}
        onPointerMissed={() => onHover(null)}
      >
        <fog attach="fog" args={[HORIZON_COLOR, 18, 48]} />
        <ambientLight intensity={0.55} color="#fff4e0" />
        <hemisphereLight args={['#dff3ff', '#c9b48a', 0.9]} />
        <directionalLight position={[6, 10, 4]} intensity={1.1} color="#fff1d6" />

        <Sea />

        <group key={`${year}-${month}`}>
          <WeekdayHeader rows={grid.rows} />
          {grid.cells.map((cell) => (
            <DayTower
              key={cell.dateKey}
              cell={cell}
              rows={grid.rows}
              events={byDate.get(cell.dateKey) ?? NO_EVENTS}
              highlighted={hoveredKey === cell.dateKey || selectedDay === cell.day}
              onHover={onHover}
              onSelect={onSelectDay}
            />
          ))}
          <AfterRise>
            <Villagers cells={grid.cells} rows={grid.rows} byDate={byDate} />
            <PixelLabels labels={dayLabels} />
          </AfterRise>
        </group>

        <CameraRig pose={pose} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.08}
          minDistance={1.2}
          maxDistance={30}
        />
      </Canvas>
      <div className="scene-tilt" aria-hidden="true" />
    </>
  );
};
