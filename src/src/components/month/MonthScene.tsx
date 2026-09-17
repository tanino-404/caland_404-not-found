import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  BLOCK_HEIGHT,
  type CameraPose,
  TOWER_WIDTH,
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
import { WeekdayHeader } from './WeekdayHeader';

export const HORIZON_COLOR = '#cfeeff';

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
    return monthCameraPose(grid.rows);
  }, [view, grid, byDate]);

  const dayLabels: PixelLabel[] = useMemo(
    () =>
      grid.cells.map((cell) => {
        const count = byDate.get(cell.dateKey)?.length ?? 0;
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
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [3.2, 11, 11.5], fov: 40, near: 0.1, far: 120 }}
      onPointerMissed={() => onHover(null)}
    >
      <fog attach="fog" args={[HORIZON_COLOR, 18, 48]} />
      <ambientLight intensity={0.75} color="#fff4e0" />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.9}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0.5]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#3f8fd6" roughness={0.6} />
      </mesh>

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
        <PixelLabels labels={dayLabels} />
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
  );
};
