import { BoxGeometry, MeshStandardMaterial } from 'three';
import { BLOCK_HEIGHT, TOWER_WIDTH } from '../../../lib/camera';
import { BLOCK_COLORS, type BlockKind } from './blockKinds';

const BLOCK_GEOMETRY = new BoxGeometry(TOWER_WIDTH, BLOCK_HEIGHT, TOWER_WIDTH);

const standard = (color: string, metalness = 0, roughness = 0.95): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness });

// BoxGeometry の面順：+x, -x, +y(上), -y(下), +z, -z
const sixFaces = (
  side: string,
  top: string,
  bottom: string,
  metalness = 0,
  roughness = 0.95,
): MeshStandardMaterial[] => {
  const s = standard(side, metalness, roughness);
  return [
    s,
    s,
    standard(top, metalness, roughness),
    standard(bottom, metalness, roughness),
    s,
    s,
  ];
};

const MATERIALS: Record<BlockKind, MeshStandardMaterial | MeshStandardMaterial[]> = {
  grass: sixFaces(BLOCK_COLORS.dirt, BLOCK_COLORS.grassTop, BLOCK_COLORS.dirtDark),
  shore: sixFaces(BLOCK_COLORS.sand, BLOCK_COLORS.grassTop, BLOCK_COLORS.sandDark),
  dirt: standard(BLOCK_COLORS.dirt),
  stone: sixFaces(BLOCK_COLORS.stoneDark, BLOCK_COLORS.stone, BLOCK_COLORS.stoneDark),
  snow: sixFaces(BLOCK_COLORS.snowSide, BLOCK_COLORS.snow, BLOCK_COLORS.snowSide),
  goldShore: sixFaces(
    BLOCK_COLORS.goldSand,
    BLOCK_COLORS.goldTop,
    BLOCK_COLORS.sandDark,
    0.45,
    0.4,
  ),
  gold: sixFaces(BLOCK_COLORS.gold, BLOCK_COLORS.goldTop, BLOCK_COLORS.goldDark, 0.35, 0.42),
  marble: sixFaces(BLOCK_COLORS.marbleSide, BLOCK_COLORS.marble, BLOCK_COLORS.marbleSide, 0.25, 0.35),
  goldGlass: sixFaces(
    BLOCK_COLORS.goldGlassSide,
    BLOCK_COLORS.goldGlass,
    BLOCK_COLORS.goldDark,
    0.75,
    0.12,
  ),
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
