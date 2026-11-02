import { Voxel } from '../Voxel';
import { GoldVoxel } from './GoldVoxel';

export interface PalmProps {
  position: [number, number, number];
}

/** 屋上のヤシ。ブルジョワなリゾート島の定番 */
export const Palm = ({ position }: PalmProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.05} h={0.36} d={0.05} color="#8b5a2b" />
    <Voxel x={0} y={0.36} z={0} w={0.04} h={0.16} d={0.04} color="#a56b32" />
    <GoldVoxel x={0} y={0.5} z={0} w={0.28} h={0.05} d={0.1} color="#2f9e4a" metalness={0.1} roughness={0.7} />
    <GoldVoxel x={0} y={0.48} z={0} w={0.1} h={0.05} d={0.28} color="#247a38" metalness={0.1} roughness={0.7} />
    <GoldVoxel x={0.12} y={0.54} z={0.08} w={0.18} h={0.04} d={0.08} color="#3ecf6e" metalness={0.08} roughness={0.65} />
    <GoldVoxel x={-0.12} y={0.54} z={-0.08} w={0.18} h={0.04} d={0.08} color="#3ecf6e" metalness={0.08} roughness={0.65} />
  </group>
);
