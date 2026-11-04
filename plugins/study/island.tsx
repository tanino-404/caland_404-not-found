import {
  BLOCK_MATERIALS,
  GRASS_TOP_MATERIAL,
  type IslandDefinition,
  STONE_BOTTOM_MATERIAL,
  pixelFaces,
  pixelMaterial,
} from '@plugin-sdk';
import { LibraryDecor } from './parts/LibraryDecor';
import { LIB_GRAY_SIDE, LIB_LIME_SIDE } from './parts/libraryTextures';

/** 知識の島：大図書館・LIBRARY の塔・巨大な本・読書の広場・滝 */

const LIME = pixelFaces(pixelMaterial(LIB_LIME_SIDE, 0, 0.9, 0), GRASS_TOP_MATERIAL, STONE_BOTTOM_MATERIAL);
const GRAY = pixelFaces(pixelMaterial(LIB_GRAY_SIDE, 0, 0.9, 0), GRASS_TOP_MATERIAL, STONE_BOTTOM_MATERIAL);

const library: IslandDefinition = {
  label: '知識の島',
  // 明るい石灰岩とグレーの石。最上段は白い数字が読めるようグレー
  blocks: (level, isTop) => {
    if (level === 0) return BLOCK_MATERIALS.shore;
    if (isTop) return GRAY;
    return level % 2 === 0 ? GRAY : LIME;
  },
  Decor: LibraryDecor,
};

export const islands: Record<string, IslandDefinition> = { library };
