import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

export const School = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.24} h={0.18} d={0.16} color="#b5533c" />
    <Voxel x={0} y={0.18} z={0} w={0.26} h={0.03} d={0.18} color="#5c2e1e" />
    <Voxel x={0} y={0.1} z={0.081} w={0.06} h={0.06} d={0.01} color="#ffffff" />
    <Voxel x={0} y={0.12} z={0.086} w={0.008} h={0.025} d={0.005} color="#1b2a41" />
    <Voxel x={-0.08} y={0.06} z={0.081} w={0.04} h={0.05} d={0.01} color="#bde0fe" />
    <Voxel x={0.08} y={0.06} z={0.081} w={0.04} h={0.05} d={0.01} color="#bde0fe" />
    <Voxel x={0} y={0} z={0.081} w={0.05} h={0.07} d={0.01} color="#3a1f12" />
    <Voxel x={0.1} y={0.21} z={0} w={0.012} h={0.14} d={0.012} color="#dddddd" />
    <Voxel x={0.125} y={0.31} z={0} w={0.04} h={0.03} d={0.006} color="#e63946" />
  </group>
);
