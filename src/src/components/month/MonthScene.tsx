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
  monthSharedCameraPose,
  partnerZOffset,
  rowToZ,
  towerTopY,
} from '../../lib/camera';
import { type MonthGrid, buildMonthGrid } from '../../lib/calendar';
import type { CalendarEvent, ViewState } from '../../types/calendar';
import { CameraRig } from './CameraRig';
import { Flight } from './Flight';
import { DayTower } from './DayTower';
import { type PixelLabel, PixelLabels } from './PixelLabels';
import { WeekdayHeader } from './WeekdayHeader';

export const HORIZON_COLOR = '#cfeeff';

export interface MonthSceneProps {
  view: Extract<ViewState, { kind: 'month' | 'day' }>;
  byDate: Map<string, CalendarEvent[]>;
  /** 相方の予定（ふたりの島モードで表示） */
  partnerByDate: Map<string, CalendarEvent[]>;
  /** ふたりの共通の予定がある日付。橋を架ける */
  commonDates: Set<string>;
  /** ふたりの島モード */
  shared: boolean;
  hoveredKey: string | null;
  onHover: (dateKey: string | null) => void;
  onSelectDay: (day: number) => void;
}

const NO_EVENTS: CalendarEvent[] = [];

const buildDayLabels = (
  grid: MonthGrid,
  byDate: Map<string, CalendarEvent[]>,
): PixelLabel[] =>
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
  });

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
  partnerByDate,
  commonDates,
  shared,
  hoveredKey,
  onHover,
  onSelectDay,
}: MonthSceneProps) => {
  const { year, month } = view;
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const selectedDay = view.kind === 'day' ? view.day : null;

  const pose: CameraPose = useMemo(() => {
    if (view.kind === 'day') {
      const cell = grid.cells[view.day - 1];
      const count = byDate.get(cell.dateKey)?.length ?? 0;
      return dayCameraPose(cell.col, cell.row, grid.rows, count);
    }
    return shared ? monthSharedCameraPose(grid.rows) : monthCameraPose(grid.rows);
  }, [view, grid, byDate, shared]);

  const dayLabels = useMemo(() => buildDayLabels(grid, byDate), [grid, byDate]);
  const partnerDayLabels = useMemo(
    () => (shared ? buildDayLabels(grid, partnerByDate) : []),
    [shared, grid, partnerByDate],
  );

  const flights: FlightSpec[] = useMemo(() => {
    if (!shared) return [];
    const zOff = partnerZOffset(grid.rows);
    // 飛行軌道が同じ列のタワーを貫通しないよう、列ごとの最大高さを取る（屋上の建物ぶんは余白 1.35 で吸収）
    const colMaxTop = Array.from({ length: 7 }, () => BLOCK_HEIGHT);
    for (const cell of grid.cells) {
      const mine = towerTopY(byDate.get(cell.dateKey)?.length ?? 0);
      const partner = towerTopY(partnerByDate.get(cell.dateKey)?.length ?? 0);
      colMaxTop[cell.col] = Math.max(colMaxTop[cell.col], mine, partner);
    }
    return grid.cells
      .filter((cell) => commonDates.has(cell.dateKey))
      .map((cell) => {
        const z0 = rowToZ(cell.row, grid.rows);
        return {
          dateKey: cell.dateKey,
          x: colToX(cell.col),
          z0,
          y0: towerTopY(byDate.get(cell.dateKey)?.length ?? 0),
          z1: z0 + zOff,
          y1: towerTopY(partnerByDate.get(cell.dateKey)?.length ?? 0),
          apexY: colMaxTop[cell.col] + 1.35,
          phase: cell.day * 0.9,
        };
      });
  }, [shared, grid, byDate, partnerByDate, commonDates]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [3.2, 11, 11.5], fov: 40, near: 0.1, far: 120 }}
      onPointerMissed={() => onHover(null)}
    >
      <fog
        key={shared ? 'fog-wide' : 'fog-near'}
        attach="fog"
        args={[HORIZON_COLOR, shared ? 26 : 18, shared ? 62 : 48]}
      />
      <ambientLight intensity={0.75} color="#fff4e0" />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.9}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
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

        {shared ? (
          <group position={[0, 0, partnerZOffset(grid.rows)]}>
            {grid.cells.map((cell) => (
              <DayTower
                key={`partner-${cell.dateKey}`}
                cell={cell}
                rows={grid.rows}
                events={partnerByDate.get(cell.dateKey) ?? NO_EVENTS}
                highlighted={false}
              />
            ))}
            <PixelLabels labels={partnerDayLabels} />
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
  );
};
