import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 美容室バリエーション3：鏡台（ドレッサー） */
export const Salon3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0.08} z={0} w={0.2} h={0.02} d={0.14} color="#f7d9e3" />
    <Voxel x={-0.08} y={0} z={0.05} w={0.02} h={0.08} d={0.02} color="#d9487a" />
    <Voxel x={0.08} y={0} z={0.05} w={0.02} h={0.08} d={0.02} color="#d9487a" />
    <Voxel x={-0.08} y={0} z={-0.05} w={0.02} h={0.08} d={0.02} color="#d9487a" />
    <Voxel x={0.08} y={0} z={-0.05} w={0.02} h={0.08} d={0.02} color="#d9487a" />
    <Voxel x={0} y={0.1} z={-0.05} w={0.14} h={0.18} d={0.02} color="#d9487a" />
    <Voxel x={0} y={0.11} z={-0.048} w={0.1} h={0.14} d={0.005} color="#cfeeff" />
    <Voxel x={0.06} y={0.1} z={0.02} w={0.02} h={0.04} d={0.02} color="#ff9fc0" />
    <Voxel x={-0.06} y={0.1} z={0.02} w={0.02} h={0.05} d={0.02} color="#ffffff" />
  </group>
);
