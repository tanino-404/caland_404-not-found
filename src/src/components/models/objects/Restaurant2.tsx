import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 飲食店バリエーション2：屋台 */
export const Restaurant2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0.02} z={0} w={0.2} h={0.12} d={0.14} color="#8b5a2b" />
    <Voxel x={0} y={0.14} z={0} w={0.24} h={0.02} d={0.2} color="#e0483e" />
    <Voxel x={-0.08} y={0} z={0.06} w={0.04} h={0.04} d={0.02} color="#2f2f2f" />
    <Voxel x={0.08} y={0} z={0.06} w={0.04} h={0.04} d={0.02} color="#2f2f2f" />
    <Voxel x={0} y={0.2} z={0.08} w={0.04} h={0.05} d={0.04} color="#e0483e" />
    <Voxel x={0} y={0.25} z={0.08} w={0.015} h={0.02} d={0.015} color="#5c3a1e" />
    <Voxel x={0} y={0.08} z={0.075} w={0.2} h={0.015} d={0.02} color="#f6e3b4" />
    <Voxel x={0} y={0.14} z={0} w={0.1} h={0.03} d={0.005} color="#ffffff" />
  </group>
);
