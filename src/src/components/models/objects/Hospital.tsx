import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

export const Hospital = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.22} h={0.24} d={0.18} color="#f0f4f8" />
    <Voxel x={0} y={0.24} z={0} w={0.24} h={0.03} d={0.2} color="#b8c4d6" />
    <Voxel x={0} y={0.1} z={0.091} w={0.03} h={0.1} d={0.01} color="#e63946" />
    <Voxel x={0} y={0.135} z={0.091} w={0.1} h={0.03} d={0.01} color="#e63946" />
    <Voxel x={0} y={0} z={0.091} w={0.06} h={0.07} d={0.01} color="#8fa3bf" />
  </group>
);
