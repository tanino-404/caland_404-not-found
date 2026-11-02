import { Voxel } from '../Voxel';
import { GoldVoxel } from './GoldVoxel';

export interface YachtProps {
  position: [number, number, number];
  yaw?: number;
}

/** 島の周りの白いヨット */
export const Yacht = ({ position, yaw = 0 }: YachtProps) => (
  <group position={position} rotation={[0, yaw, 0]}>
    <Voxel x={0} y={0} z={0} w={0.7} h={0.08} d={0.22} color="#f4f7fb" />
    <Voxel x={0.28} y={0} z={0} w={0.18} h={0.08} d={0.14} color="#e8eef6" />
    <GoldVoxel x={0} y={0.08} z={0} w={0.42} h={0.04} d={0.16} color="#ffd24a" />
    <Voxel x={-0.04} y={0.12} z={0} w={0.22} h={0.1} d={0.12} color="#ffffff" />
    <Voxel x={-0.04} y={0.16} z={0.065} w={0.12} h={0.05} d={0.01} color="#7ec8e8" />
    <GoldVoxel x={-0.22} y={0.12} z={0} w={0.02} h={0.22} d={0.02} color="#e6b422" />
    <Voxel x={0.22} y={0.08} z={0} w={0.08} h={0.05} d={0.08} color="#3ec8e8" />
  </group>
);
