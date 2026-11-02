import { GoldVoxel } from './GoldVoxel';

export interface DollarSignProps {
  position: [number, number, number];
}

/** 高層の側面に出す金の $ */
export const DollarSign = ({ position }: DollarSignProps) => (
  <group position={position}>
    <GoldVoxel x={0} y={0.02} z={0} w={0.16} h={0.05} d={0.04} color="#ffe56a" />
    <GoldVoxel x={-0.07} y={0.08} z={0} w={0.05} h={0.08} d={0.04} color="#ffe56a" />
    <GoldVoxel x={0.07} y={0.08} z={0} w={0.05} h={0.05} d={0.04} color="#ffe56a" />
    <GoldVoxel x={0} y={0.14} z={0} w={0.16} h={0.05} d={0.04} color="#ffe56a" />
    <GoldVoxel x={0.07} y={0.2} z={0} w={0.05} h={0.08} d={0.04} color="#ffe56a" />
    <GoldVoxel x={-0.07} y={0.2} z={0} w={0.05} h={0.05} d={0.04} color="#ffe56a" />
    <GoldVoxel x={0} y={0.26} z={0} w={0.16} h={0.05} d={0.04} color="#ffe56a" />
    <GoldVoxel x={0} y={-0.02} z={0} w={0.04} h={0.36} d={0.03} color="#fff1a8" />
  </group>
);
