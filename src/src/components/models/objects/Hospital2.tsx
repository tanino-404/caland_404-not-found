import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 病院バリエーション2：救急車 */
export const Hospital2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0.03} z={0} w={0.22} h={0.12} d={0.14} color="#ffffff" />
    <Voxel x={0} y={0.06} z={0.071} w={0.22} h={0.03} d={0.005} color="#e63946" />
    <Voxel x={0.05} y={0.1} z={0.071} w={0.025} h={0.06} d={0.006} color="#e63946" />
    <Voxel x={0.05} y={0.12} z={0.071} w={0.05} h={0.02} d={0.006} color="#e63946" />
    <Voxel x={-0.07} y={0} z={0.06} w={0.04} h={0.04} d={0.02} color="#2f2f2f" />
    <Voxel x={0.07} y={0} z={0.06} w={0.04} h={0.04} d={0.02} color="#2f2f2f" />
    <Voxel x={-0.07} y={0} z={-0.06} w={0.04} h={0.04} d={0.02} color="#2f2f2f" />
    <Voxel x={0.07} y={0} z={-0.06} w={0.04} h={0.04} d={0.02} color="#2f2f2f" />
    <Voxel x={0} y={0.15} z={0} w={0.1} h={0.02} d={0.05} color="#ff5c5c" />
  </group>
);
