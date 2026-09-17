import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 旅行バリエーション3：灯台 */
export const Airplane3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.1} h={0.1} d={0.1} color="#ffffff" />
    <Voxel x={0} y={0.1} z={0} w={0.09} h={0.06} d={0.09} color="#e63946" />
    <Voxel x={0} y={0.16} z={0} w={0.08} h={0.06} d={0.08} color="#ffffff" />
    <Voxel x={0} y={0.22} z={0} w={0.07} h={0.06} d={0.07} color="#e63946" />
    <Voxel x={0} y={0.28} z={0} w={0.06} h={0.05} d={0.06} color="#bde0fe" />
    <Voxel x={0} y={0.33} z={0} w={0.05} h={0.03} d={0.05} color="#2b2b2b" />
    <Voxel x={0} y={0.3} z={0} w={0.02} h={0.02} d={0.02} color="#ffe28a" />
  </group>
);
