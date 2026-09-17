import { Voxel } from '../Voxel';
import type { ObjectProps } from './types';

/** 学校バリエーション2：積み上げた本 */
export const School2 = ({ position }: ObjectProps) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.2} h={0.05} d={0.16} color="#e63946" />
    <Voxel x={0.01} y={0.05} z={0} w={0.18} h={0.05} d={0.15} color="#2e86de" />
    <Voxel x={-0.01} y={0.1} z={0} w={0.16} h={0.05} d={0.14} color="#ffd166" />
    <Voxel x={0} y={0} z={0.075} w={0.19} h={0.05} d={0.01} color="#fbfbfb" />
    <Voxel x={0.01} y={0.05} z={0.07} w={0.17} h={0.05} d={0.01} color="#fbfbfb" />
    <Voxel x={-0.01} y={0.1} z={0.065} w={0.15} h={0.05} d={0.01} color="#fbfbfb" />
    <Voxel x={0.05} y={0.12} z={0.04} w={0.015} h={0.06} d={0.005} color="#e63946" />
  </group>
);
