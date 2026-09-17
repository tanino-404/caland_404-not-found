import { colToX, rowToZ } from '../../lib/camera';
import { WEEKDAY_LABELS } from '../../lib/calendar';
import { Voxel } from '../models/Voxel';
import { type PixelLabel, PixelLabels } from './PixelLabels';

export const HEADER_OFFSET_Z = -1.05;
const SIGN_TILT = -0.32;
const SIGN_W = 0.86;
const SIGN_H = 0.44;
const POST_H = 0.32;

const LABEL_COLORS = ['#c9403a', '#1b2a41', '#1b2a41', '#1b2a41', '#1b2a41', '#1b2a41', '#2e6fd6'];

const SIGN_LABELS: PixelLabel[] = WEEKDAY_LABELS.map((text, col) => ({
  text,
  position: [colToX(col), SIGN_H / 2, 0.02],
  rotation: [0, 0, 0],
  color: LABEL_COLORS[col],
  pitch: 0.065,
}));

export interface WeekdayHeaderProps {
  rows: number;
}

/** グリッド奥に立つ 7 枚の木の看板（SUN〜SAT） */
export const WeekdayHeader = ({ rows }: WeekdayHeaderProps) => {
  const z = rowToZ(0, rows) + HEADER_OFFSET_Z;

  return (
    <group>
      {WEEKDAY_LABELS.map((_, col) => (
        <group key={col} position={[colToX(col), 0, z]}>
          <Voxel x={0} y={0} z={0} w={0.92} h={0.12} d={0.92} color="#a4885a" />
          <Voxel x={0} y={0.12} z={-0.02} w={0.06} h={POST_H - 0.12} d={0.06} color="#6b4a2b" />
          <group position={[0, POST_H, 0]} rotation={[SIGN_TILT, 0, 0]}>
            <Voxel x={0} y={0} z={-0.01} w={SIGN_W} h={SIGN_H} d={0.05} color="#f3e2b6" />
            <Voxel x={0} y={SIGN_H} z={-0.01} w={SIGN_W + 0.04} h={0.03} d={0.07} color="#6b4a2b" />
          </group>
        </group>
      ))}
      <group position={[0, POST_H, z]} rotation={[SIGN_TILT, 0, 0]}>
        <PixelLabels labels={SIGN_LABELS} />
      </group>
    </group>
  );
};
