import { GoldVoxel, Voxel } from '@plugin-sdk';

export interface PoolProps {
  position: [number, number, number];
}

/** 屋上プール。金の縁取りにターコイズの水 */
export const Pool = ({ position }: PoolProps) => (
  <group position={position}>
    <GoldVoxel x={0} y={0} z={0} w={0.42} h={0.05} d={0.28} color="#e6b422" />
    <Voxel x={0} y={0.04} z={0} w={0.32} h={0.03} d={0.18} color="#3ec8e8" />
    <Voxel x={0} y={0.055} z={0} w={0.2} h={0.015} d={0.1} color="#9ef0ff" />
    <Voxel x={0.16} y={0.05} z={0.1} w={0.05} h={0.04} d={0.05} color="#fff8e7" />
  </group>
);
