import { BoxGeometry, MeshStandardMaterial } from 'three';
import { BLOCK_HEIGHT, TOWER_WIDTH } from '../../../lib/camera';
import { BLOCK_COLORS, type BlockKind } from './blockKinds';

const BLOCK_GEOMETRY = new BoxGeometry(TOWER_WIDTH, BLOCK_HEIGHT, TOWER_WIDTH);

const standard = (color: string): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });

// BoxGeometry の面順：+x, -x, +y(上), -y(下), +z, -z
const sixFaces = (side: string, top: string, bottom: string): MeshStandardMaterial[] => {
  const s = standard(side);
  return [s, s, standard(top), standard(bottom), s, s];
};

const MATERIALS: Record<BlockKind, MeshStandardMaterial | MeshStandardMaterial[]> = {
  grass: sixFaces(BLOCK_COLORS.dirt, BLOCK_COLORS.grassTop, BLOCK_COLORS.dirtDark),
  shore: sixFaces(BLOCK_COLORS.sand, BLOCK_COLORS.grassTop, BLOCK_COLORS.sandDark),
  dirt: standard(BLOCK_COLORS.dirt),
  stone: sixFaces(BLOCK_COLORS.stoneDark, BLOCK_COLORS.stone, BLOCK_COLORS.stoneDark),
  snow: sixFaces(BLOCK_COLORS.snowSide, BLOCK_COLORS.snow, BLOCK_COLORS.snowSide),
};

export interface BlockProps {
  level: number;
  kind: BlockKind;
}

export const Block = ({ level, kind }: BlockProps) => (
  <mesh
    geometry={BLOCK_GEOMETRY}
    material={MATERIALS[kind]}
    position={[0, BLOCK_HEIGHT / 2 + BLOCK_HEIGHT * level, 0]}
  />
);
