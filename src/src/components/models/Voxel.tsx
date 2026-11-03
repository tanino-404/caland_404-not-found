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
  /** false ならクリック判定しない（島の予定を隠さないエフェクト用） */
  pick?: boolean;
}

export const Voxel = ({ x, y, z, w, h, d, color, pick = true }: VoxelProps) => (
  <mesh
    geometry={UNIT_BOX}
    material={materialFor(color)}
    position={[x, y + h / 2, z]}
    scale={[w, h, d]}
    raycast={pick ? undefined : () => {}}
  />
);
