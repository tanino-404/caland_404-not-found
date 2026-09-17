import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

const WINDOW_ROWS = [0.05, 0.14, 0.23, 0.32];

export const Office = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.16} h={0.42} d={0.16} color="#5b6b8c" />
    <Voxel x={0} y={0.42} z={0} w={0.18} h={0.02} d={0.18} color="#3b4660" />
    <Voxel x={0.05} y={0.44} z={0} w={0.02} h={0.07} d={0.02} color="#d8d8d8" />
    {WINDOW_ROWS.map((y) => (
      <group key={y}>
        <Voxel x={-0.04} y={y} z={0.081} w={0.03} h={0.045} d={0.01} color="#ffd166" />
        <Voxel x={0.04} y={y} z={0.081} w={0.03} h={0.045} d={0.01} color="#ffd166" />
      </group>
    ))}
  </group>
);
