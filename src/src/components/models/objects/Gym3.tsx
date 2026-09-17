import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** ジムバリエーション3：ランニングトラック */
export const Gym3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0.01} z={0.08} w={0.2} h={0.02} d={0.04} color="#b5533c" />
    <Voxel x={0} y={0.01} z={-0.08} w={0.2} h={0.02} d={0.04} color="#b5533c" />
    <Voxel x={-0.1} y={0.01} z={0} w={0.04} h={0.02} d={0.16} color="#b5533c" />
    <Voxel x={0.1} y={0.01} z={0} w={0.04} h={0.02} d={0.16} color="#b5533c" />
    <Voxel x={0} y={0.005} z={0} w={0.14} h={0.01} d={0.1} color="#6fae6f" />
    <Voxel x={0} y={0.02} z={-0.1} w={0.05} h={0.08} d={0.03} color="#2f3542" />
    <Voxel x={0} y={0.1} z={-0.1} w={0.01} h={0.04} d={0.01} color="#ff7f11" />
    <Voxel x={0.015} y={0.13} z={-0.1} w={0.02} h={0.02} d={0.005} color="#ffffff" />
  </group>
);
