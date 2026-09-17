import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

export const Gym = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.24} h={0.16} d={0.2} color="#2f3542" />
    <Voxel x={0} y={0.16} z={0} w={0.24} h={0.03} d={0.2} color="#ff7f11" />
    <Voxel x={0} y={0.09} z={0.101} w={0.12} h={0.04} d={0.01} color="#ff7f11" />
    <Voxel x={0} y={0.2} z={0} w={0.12} h={0.02} d={0.02} color="#c8c8c8" />
    <Voxel x={-0.06} y={0.18} z={0} w={0.03} h={0.06} d={0.05} color="#555b66" />
    <Voxel x={0.06} y={0.18} z={0} w={0.03} h={0.06} d={0.05} color="#555b66" />
  </group>
);
