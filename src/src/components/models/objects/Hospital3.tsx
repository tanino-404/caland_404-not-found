import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 病院バリエーション3：薬局 */
export const Hospital3 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.2} h={0.2} d={0.16} color="#f0f4f8" />
    <Voxel x={0} y={0.2} z={0} w={0.22} h={0.03} d={0.18} color="#7fae7f" />
    <Voxel x={0} y={0.08} z={0.081} w={0.025} h={0.09} d={0.01} color="#2e8b57" />
    <Voxel x={0} y={0.11} z={0.081} w={0.09} h={0.025} d={0.01} color="#2e8b57" />
    <Voxel x={0} y={0} z={0.081} w={0.05} h={0.08} d={0.01} color="#8fa3bf" />
    <Voxel x={-0.07} y={0.06} z={0.081} w={0.035} h={0.05} d={0.01} color="#bde0fe" />
    <Voxel x={0.07} y={0.06} z={0.081} w={0.035} h={0.05} d={0.01} color="#bde0fe" />
  </group>
);
