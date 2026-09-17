import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 結婚式バリエーション3：ハート看板の建物 */
export const Church3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.18} h={0.18} d={0.16} color="#fbfbfb" />
    <Voxel x={0} y={0.18} z={0} w={0.2} h={0.03} d={0.18} color="#c94c4c" />
    <Voxel x={-0.02} y={0.12} z={0.081} w={0.035} h={0.035} d={0.01} color="#e63946" />
    <Voxel x={0.02} y={0.12} z={0.081} w={0.035} h={0.035} d={0.01} color="#e63946" />
    <Voxel x={0} y={0.08} z={0.081} w={0.05} h={0.04} d={0.01} color="#e63946" />
    <Voxel x={0} y={0} z={0.081} w={0.05} h={0.08} d={0.01} color="#6b4a2b" />
    <Voxel x={-0.06} y={0.05} z={0.081} w={0.03} h={0.04} d={0.01} color="#7fb3ff" />
    <Voxel x={0.06} y={0.05} z={0.081} w={0.03} h={0.04} d={0.01} color="#7fb3ff" />
  </group>
);
