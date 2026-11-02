import { UNIT_BOX, materialForMetal } from '../materials';

export interface GoldVoxelProps {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  metalness?: number;
  roughness?: number;
}

/** 黄金郷の金・ガラス用ボクセル */
export const GoldVoxel = ({
  x,
  y,
  z,
  w,
  h,
  d,
  color,
  metalness = 0.82,
  roughness = 0.22,
}: GoldVoxelProps) => (
  <mesh
    geometry={UNIT_BOX}
    material={materialForMetal(color, metalness, roughness)}
    position={[x, y + h / 2, z]}
    scale={[w, h, d]}
  />
);
