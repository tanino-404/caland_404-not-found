import { GoldVoxel, Voxel } from '@plugin-sdk';

export interface CarProps {
  position: [number, number, number];
  yaw?: number;
}

/** 屋上の金のスポーツカー */
export const Car = ({ position, yaw = 0 }: CarProps) => (
  <group position={position} rotation={[0, yaw, 0]}>
    <GoldVoxel x={0} y={0.04} z={0} w={0.2} h={0.05} d={0.1} color="#ffd24a" />
    <GoldVoxel x={-0.02} y={0.09} z={0} w={0.12} h={0.04} d={0.08} color="#ffe066" />
    <Voxel x={-0.02} y={0.1} z={0} w={0.08} h={0.03} d={0.07} color="#1b2a41" />
    <Voxel x={-0.07} y={0} z={0.05} w={0.04} h={0.04} d={0.02} color="#2a2a2a" />
    <Voxel x={0.07} y={0} z={0.05} w={0.04} h={0.04} d={0.02} color="#2a2a2a" />
    <Voxel x={-0.07} y={0} z={-0.05} w={0.04} h={0.04} d={0.02} color="#2a2a2a" />
    <Voxel x={0.07} y={0} z={-0.05} w={0.04} h={0.04} d={0.02} color="#2a2a2a" />
  </group>
);
