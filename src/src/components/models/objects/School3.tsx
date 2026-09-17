import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 学校バリエーション3：黒板と教壇 */
export const School3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0.06} z={0} w={0.2} h={0.14} d={0.02} color="#1b2a41" />
    <Voxel x={0} y={0.2} z={0} w={0.22} h={0.02} d={0.025} color="#5c2e1e" />
    <Voxel x={0} y={0.05} z={0.02} w={0.2} h={0.015} d={0.02} color="#dddddd" />
    <Voxel x={-0.08} y={0} z={0.06} w={0.015} h={0.08} d={0.015} color="#5c2e1e" />
    <Voxel x={0.08} y={0} z={0.06} w={0.015} h={0.08} d={0.015} color="#5c2e1e" />
    <Voxel x={0} y={0} z={-0.05} w={0.015} h={0.1} d={0.015} color="#5c2e1e" />
    <Voxel x={-0.05} y={0.13} z={0.011} w={0.03} h={0.01} d={0.005} color="#ffffff" />
    <Voxel x={0.03} y={0.1} z={0.011} w={0.04} h={0.01} d={0.005} color="#ffffff" />
  </group>
);
