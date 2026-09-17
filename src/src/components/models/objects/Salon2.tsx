import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 美容室バリエーション2：ハサミ看板を掲げた小さな店舗 */
export const Salon2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.16} h={0.18} d={0.14} color="#ffb3d1" />
    <Voxel x={0} y={0.18} z={0} w={0.18} h={0.03} d={0.16} color="#d9487a" />
    <Voxel x={0} y={0} z={0.071} w={0.05} h={0.09} d={0.01} color="#7a2e4a" />
    <Voxel x={-0.05} y={0.09} z={0.071} w={0.035} h={0.05} d={0.01} color="#fff4fa" />
    <Voxel x={0.09} y={0.02} z={0.03} w={0.014} h={0.2} d={0.014} color="#ffffff" />
    <Voxel x={0.09} y={0.22} z={0.03} w={0.07} h={0.06} d={0.015} color="#ffffff" />
    <Voxel x={0.075} y={0.22} z={0.04} w={0.045} h={0.01} d={0.008} color="#7a2e4a" />
    <Voxel x={0.105} y={0.22} z={0.04} w={0.045} h={0.01} d={0.008} color="#d9487a" />
  </group>
);
