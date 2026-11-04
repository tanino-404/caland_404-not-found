import { BoxGeometry, MeshStandardMaterial } from 'three';
import { BLOCK_HEIGHT, TOWER_WIDTH } from '../../../lib/camera';
import type { BlockMaterial, Island } from '../../../types/island';
import { BLOCK_COLORS, type BlockKind, plainBlockKind } from './blockKinds';
import { type PixelTexture, noise, paintPixels } from './pixelTexture';

/** 積むブロック 1 個の形。年ビューの InstancedMesh も同じものを使う */
export const BLOCK_GEOMETRY = new BoxGeometry(TOWER_WIDTH, BLOCK_HEIGHT, TOWER_WIDTH);

export const standardMaterial = (color: string, metalness = 0, roughness = 0.95): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness });

// BoxGeometry の面順：+x, -x, +y(上), -y(下), +z, -z
const sixFaces = (
  side: string,
  top: string,
  bottom: string,
  metalness = 0,
  roughness = 0.95,
): MeshStandardMaterial[] => {
  const s = standardMaterial(side, metalness, roughness);
  return [
    s,
    s,
    standardMaterial(top, metalness, roughness),
    standardMaterial(bottom, metalness, roughness),
    s,
    s,
  ];
};

/** ドット絵の面。テクスチャの光る色（paintPixels の glowColors）だけ emissive の色で glow の強さに光る */
export const pixelMaterial = (
  texture: PixelTexture,
  metalness: number,
  roughness: number,
  glow: number,
  emissive = '#ffd36a',
): MeshStandardMaterial =>
  new MeshStandardMaterial({
    map: texture.map,
    emissiveMap: texture.glow,
    emissive,
    emissiveIntensity: glow,
    metalness,
    roughness,
  });

/** 側面 4 枚・天面・底面の 6 面 */
export const pixelFaces = (
  side: MeshStandardMaterial,
  top: MeshStandardMaterial,
  bottom: MeshStandardMaterial,
): MeshStandardMaterial[] => [side, side, top, bottom, side, side];

const GRASS = ['#5fb63b', '#57ab35', '#6cc444', '#4f9e30'];

/** ドット絵の芝（16×16） */
export const GRASS_TOP_TEXTURE = paintPixels(16, 16, new Set<string>(), (set) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      set(x, y, GRASS[Math.floor(noise(x, y, 11) * GRASS.length)]);
    }
  }
});

/** 達成した島の塔でよく使う天面（ドット絵の芝）と底面（灰色） */
export const GRASS_TOP_MATERIAL = pixelMaterial(GRASS_TOP_TEXTURE, 0, 0.95, 0);
export const STONE_BOTTOM_MATERIAL = standardMaterial('#5f646c');

/** いつもの島のブロック種別 → 材質（6 面） */
export const BLOCK_MATERIALS: Record<BlockKind, BlockMaterial> = {
  grass: sixFaces(BLOCK_COLORS.dirt, BLOCK_COLORS.grassTop, BLOCK_COLORS.dirtDark),
  shore: sixFaces(BLOCK_COLORS.sand, BLOCK_COLORS.grassTop, BLOCK_COLORS.sandDark),
  dirt: standardMaterial(BLOCK_COLORS.dirt),
  stone: sixFaces(BLOCK_COLORS.stoneDark, BLOCK_COLORS.stone, BLOCK_COLORS.stoneDark),
  snow: sixFaces(BLOCK_COLORS.snowSide, BLOCK_COLORS.snow, BLOCK_COLORS.snowSide),
};

/** 塔の level 段目の材質。島がブロックを持っていればそれ、無ければいつもの草・土・石・雪 */
export const blockMaterialFor = (level: number, isTop: boolean, island: Island | null): BlockMaterial =>
  island?.blocks !== undefined ? island.blocks(level, isTop) : BLOCK_MATERIALS[plainBlockKind(level, isTop)];
