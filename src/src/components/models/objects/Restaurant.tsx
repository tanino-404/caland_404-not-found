import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

export const Restaurant = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.22} h={0.18} d={0.18} color="#f6e3b4" />
    <Voxel x={0} y={0.18} z={0} w={0.24} h={0.04} d={0.2} color="#8b5a2b" />
    <Voxel x={0} y={0.125} z={0.1} w={0.24} h={0.03} d={0.06} color="#e0483e" />
    <Voxel x={-0.08} y={0.125} z={0.1} w={0.04} h={0.031} d={0.061} color="#ffffff" />
    <Voxel x={0.08} y={0.125} z={0.1} w={0.04} h={0.031} d={0.061} color="#ffffff" />
    <Voxel x={0} y={0} z={0.09} w={0.05} h={0.09} d={0.01} color="#5c3a1e" />
    <Voxel x={-0.07} y={0.05} z={0.09} w={0.05} h={0.05} d={0.01} color="#ffe28a" />
    <Voxel x={0.07} y={0.05} z={0.09} w={0.05} h={0.05} d={0.01} color="#ffe28a" />
    <Voxel x={0} y={0.22} z={0.04} w={0.1} h={0.05} d={0.02} color="#ffd166" />
  </group>
);
