import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 旅行バリエーション2：スーツケース */
export const Airplane2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0.02} z={0} w={0.18} h={0.14} d={0.06} color="#2e86de" />
    <Voxel x={0} y={0.02} z={0} w={0.18} h={0.03} d={0.062} color="#f2f2f2" />
    <Voxel x={0} y={0.17} z={0} w={0.06} h={0.02} d={0.02} color="#1b2a41" />
    <Voxel x={-0.08} y={0} z={0} w={0.02} h={0.02} d={0.02} color="#2f2f2f" />
    <Voxel x={0.08} y={0} z={0} w={0.02} h={0.02} d={0.02} color="#2f2f2f" />
    <Voxel x={-0.05} y={0.09} z={0.031} w={0.02} h={0.03} d={0.005} color="#ffd700" />
    <Voxel x={0.05} y={0.09} z={0.031} w={0.02} h={0.03} d={0.005} color="#ffd700" />
    <Voxel x={0.08} y={0.05} z={0.031} w={0.02} h={0.02} d={0.005} color="#ffffff" />
  </group>
);
