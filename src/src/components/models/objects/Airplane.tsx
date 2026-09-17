import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

export const Airplane = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.24} h={0.01} d={0.24} color="#3a3a3a" />
    <Voxel x={0} y={0.005} z={0} w={0.02} h={0.006} d={0.2} color="#f2f2f2" />
    <Voxel x={0} y={0.06} z={0} w={0.07} h={0.06} d={0.22} color="#f8f8f8" />
    <Voxel x={0} y={0.07} z={0.12} w={0.05} h={0.04} d={0.03} color="#2e86de" />
    <Voxel x={0} y={0.085} z={0} w={0.24} h={0.02} d={0.06} color="#2e86de" />
    <Voxel x={0} y={0.12} z={-0.1} w={0.02} h={0.06} d={0.05} color="#2e86de" />
    <Voxel x={0} y={0.1} z={0.04} w={0.03} h={0.02} d={0.06} color="#1b2a41" />
  </group>
);
