import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

export const Salon = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.2} h={0.22} d={0.18} color="#ff9fc0" />
    <Voxel x={0} y={0.22} z={0} w={0.22} h={0.04} d={0.2} color="#d9487a" />
    <Voxel x={0} y={0} z={0.09} w={0.06} h={0.1} d={0.01} color="#7a2e4a" />
    <Voxel x={-0.06} y={0.11} z={0.09} w={0.04} h={0.05} d={0.01} color="#fff4fa" />
    <Voxel x={0.06} y={0.11} z={0.09} w={0.04} h={0.05} d={0.01} color="#fff4fa" />
    <Voxel x={0.125} y={0.02} z={0.06} w={0.03} h={0.18} d={0.03} color="#ffffff" />
    <Voxel x={0.125} y={0.06} z={0.06} w={0.032} h={0.03} d={0.032} color="#e63946" />
    <Voxel x={0.125} y={0.13} z={0.06} w={0.032} h={0.03} d={0.032} color="#e63946" />
  </group>
);
