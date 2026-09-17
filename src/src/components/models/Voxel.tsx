import { UNIT_BOX, materialFor } from './materials';

export interface VoxelProps {
  /** 中心 x */
  x: number;
  /** 底面 y */
  y: number;
  /** 中心 z */
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
}

export const Voxel = ({ x, y, z, w, h, d, color }: VoxelProps) => (
  <mesh
    geometry={UNIT_BOX}
    material={materialFor(color)}
    position={[x, y + h / 2, z]}
    scale={[w, h, d]}
  />
);
