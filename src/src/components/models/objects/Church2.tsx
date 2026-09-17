import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 結婚式バリエーション2：ウェディングケーキ */
export const Church2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.2} h={0.08} d={0.2} color="#fff4fa" />
    <Voxel x={0} y={0.08} z={0} w={0.15} h={0.07} d={0.15} color="#ffe8f0" />
    <Voxel x={0} y={0.15} z={0} w={0.1} h={0.06} d={0.1} color="#fff4fa" />
    <Voxel x={0} y={0.21} z={0} w={0.03} h={0.03} d={0.03} color="#e63946" />
    <Voxel x={0} y={0.04} z={0.101} w={0.2} h={0.015} d={0.005} color="#ffd700" />
    <Voxel x={0} y={0.115} z={0.076} w={0.15} h={0.015} d={0.005} color="#ffd700" />
    <Voxel x={0} y={0.18} z={0.051} w={0.1} h={0.015} d={0.005} color="#ffd700" />
    <Voxel x={0} y={0.24} z={0} w={0.02} h={0.02} d={0.02} color="#ff9fc0" />
  </group>
);
