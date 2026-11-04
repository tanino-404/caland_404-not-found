import {
  BLOCK_MATERIALS,
  GRASS_TOP_MATERIAL,
  type IslandDefinition,
  STONE_BOTTOM_MATERIAL,
  pixelFaces,
  pixelMaterial,
} from '@plugin-sdk';
import { MuscleDecor } from './parts/MuscleDecor';
import { GYM_SLATE_SIDE, GYM_STONE_SIDE } from './parts/gymTextures';

/** マッチョの島：巨大なボディビルダー・PROTEIN 看板・シェイカー・石レンガの塔・競泳レーン */

const STONE = pixelFaces(pixelMaterial(GYM_STONE_SIDE, 0.05, 0.85, 0.35), GRASS_TOP_MATERIAL, STONE_BOTTOM_MATERIAL);
const SLATE = pixelFaces(pixelMaterial(GYM_SLATE_SIDE, 0.05, 0.8, 0.35), GRASS_TOP_MATERIAL, STONE_BOTTOM_MATERIAL);

const muscle: IslandDefinition = {
  label: 'マッチョの島',
  // 灰色の石と濃いスレートのレンガ。最上段は白い数字が読めるようスレート
  blocks: (level, isTop) => {
    if (level === 0) return BLOCK_MATERIALS.shore;
    if (isTop) return SLATE;
    return level % 3 === 0 ? SLATE : STONE;
  },
  Decor: MuscleDecor,
};

export const islands: Record<string, IslandDefinition> = { muscle };
