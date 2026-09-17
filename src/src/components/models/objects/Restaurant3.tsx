import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 飲食店バリエーション3：ラーメン屋（暖簾） */
export const Restaurant3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.18} h={0.16} d={0.16} color="#f6e3b4" />
    <Voxel x={0} y={0.16} z={0} w={0.2} h={0.03} d={0.18} color="#8b5a2b" />
    <Voxel x={-0.04} y={0.02} z={0.081} w={0.035} h={0.08} d={0.008} color="#e0483e" />
    <Voxel x={0.04} y={0.02} z={0.081} w={0.035} h={0.08} d={0.008} color="#e0483e" />
    <Voxel x={0} y={0.02} z={0.081} w={0.01} h={0.08} d={0.006} color="#ffffff" />
    <Voxel x={0} y={0.11} z={0.081} w={0.05} h={0.03} d={0.01} color="#ffffff" />
    <Voxel x={0} y={0.2} z={0.03} w={0.03} h={0.02} d={0.03} color="#ffffff" />
    <Voxel x={0.09} y={0.1} z={0.05} w={0.03} h={0.04} d={0.03} color="#e0483e" />
  </group>
);
