import { Voxel } from '../Voxel';
import { Petals } from './Petals';
import type { ObjectProps } from './types';

export const Church = ({ position }: ObjectProps) => (
  <group position={position}>
    <Petals top={0.2} />
    <Voxel x={0} y={0} z={0.02} w={0.2} h={0.16} d={0.14} color="#fbfbfb" />
    <Voxel x={0} y={0.16} z={0.02} w={0.22} h={0.05} d={0.16} color="#c94c4c" />
    <Voxel x={0} y={0} z={-0.06} w={0.08} h={0.3} d={0.08} color="#fbfbfb" />
    <Voxel x={0} y={0.3} z={-0.06} w={0.06} h={0.06} d={0.06} color="#c94c4c" />
    <Voxel x={0} y={0.36} z={-0.06} w={0.012} h={0.07} d={0.012} color="#ffd700" />
    <Voxel x={0} y={0.4} z={-0.06} w={0.04} h={0.012} d={0.012} color="#ffd700" />
    <Voxel x={0} y={0} z={0.095} w={0.05} h={0.08} d={0.01} color="#6b4a2b" />
    <Voxel x={0} y={0.09} z={0.095} w={0.03} h={0.04} d={0.01} color="#7fb3ff" />
  </group>
);
