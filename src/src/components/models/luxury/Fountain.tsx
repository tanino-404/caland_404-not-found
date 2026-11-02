import { Voxel } from '../Voxel';
import { GoldVoxel } from './GoldVoxel';

export interface FountainProps {
  position: [number, number, number];
}

/** 金の噴水 */
export const Fountain = ({ position }: FountainProps) => (
  <group position={position}>
    <GoldVoxel x={0} y={0} z={0} w={0.18} h={0.04} d={0.18} color="#e6b422" />
    <Voxel x={0} y={0.035} z={0} w={0.12} h={0.02} d={0.12} color="#4fd0f0" />
    <GoldVoxel x={0} y={0.04} z={0} w={0.04} h={0.12} d={0.04} color="#ffd24a" />
    <Voxel x={0} y={0.14} z={0} w={0.03} h={0.08} d={0.03} color="#9ef0ff" />
    <Voxel x={0.04} y={0.12} z={0} w={0.05} h={0.02} d={0.02} color="#c8f4ff" />
    <Voxel x={-0.04} y={0.11} z={0} w={0.05} h={0.02} d={0.02} color="#c8f4ff" />
  </group>
);
