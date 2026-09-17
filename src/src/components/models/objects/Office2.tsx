import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 仕事バリエーション2：PCデスク風の建物 */
export const Office2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.18} h={0.28} d={0.16} color="#5b6b8c" />
    <Voxel x={0} y={0.28} z={0} w={0.2} h={0.02} d={0.18} color="#3b4660" />
    <Voxel x={0} y={0.14} z={0.081} w={0.1} h={0.08} d={0.01} color="#7fd1ff" />
    <Voxel x={0} y={0.14} z={0.079} w={0.12} h={0.1} d={0.005} color="#2b2b2b" />
    <Voxel x={0} y={0.04} z={0.08} w={0.06} h={0.02} d={0.02} color="#8a8a8a" />
    <Voxel x={0} y={0.06} z={0.09} w={0.05} h={0.015} d={0.02} color="#d8d8d8" />
    <Voxel x={-0.05} y={0.22} z={0.081} w={0.02} h={0.03} d={0.01} color="#ffd166" />
    <Voxel x={0.05} y={0.22} z={0.081} w={0.02} h={0.03} d={0.01} color="#ffd166" />
  </group>
);
