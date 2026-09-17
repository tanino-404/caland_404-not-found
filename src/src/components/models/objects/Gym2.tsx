import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** ジムバリエーション2：ダンベル看板の建物 */
export const Gym2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.2} h={0.14} d={0.18} color="#2f3542" />
    <Voxel x={0} y={0.14} z={0} w={0.22} h={0.03} d={0.2} color="#ff7f11" />
    <Voxel x={0} y={0.17} z={0} w={0.015} h={0.12} d={0.015} color="#c8c8c8" />
    <Voxel x={0} y={0.29} z={0} w={0.06} h={0.03} d={0.06} color="#555b66" />
    <Voxel x={0} y={0.17} z={0} w={0.06} h={0.03} d={0.06} color="#555b66" />
    <Voxel x={0} y={0} z={0.091} w={0.05} h={0.08} d={0.01} color="#ff7f11" />
    <Voxel x={-0.06} y={0.08} z={0.091} w={0.03} h={0.04} d={0.01} color="#c8c8c8" />
  </group>
);
