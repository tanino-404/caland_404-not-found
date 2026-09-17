import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

const WINDOW_ROWS = [0.08, 0.16, 0.24];

/** 仕事バリエーション3：高層ビル */
export const Office3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.12} h={0.34} d={0.12} color="#4a5570" />
    <Voxel x={0} y={0.34} z={0} w={0.14} h={0.03} d={0.14} color="#2b3347" />
    <Voxel x={0} y={0.37} z={0} w={0.01} h={0.07} d={0.01} color="#cccccc" />
    {WINDOW_ROWS.map((y) => (
      <group key={y}>
        <Voxel x={-0.03} y={y} z={0.061} w={0.02} h={0.04} d={0.01} color="#ffd166" />
        <Voxel x={0.03} y={y} z={0.061} w={0.02} h={0.04} d={0.01} color="#ffd166" />
      </group>
    ))}
  </group>
);
