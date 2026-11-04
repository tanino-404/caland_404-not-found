import {
  BLOCK_MATERIALS,
  GRASS_TOP_MATERIAL,
  type IslandDefinition,
  STONE_BOTTOM_MATERIAL,
  pixelFaces,
  pixelMaterial,
} from '@plugin-sdk';
import { FishingDecor } from './parts/FishingDecor';
import { FISH_ROCK_SIDE, FISH_SAND_SIDE } from './parts/fishingTextures';

/** 漁業の島：釣り人の並ぶ桟橋・魚市場・漁村・水族館・灯台・跳ねるカジキ・いちばん高い塔から跳ねる巨大マグロ */

// 上の縁の潮の帯だけが白く光る
const ROCK = pixelFaces(pixelMaterial(FISH_ROCK_SIDE, 0, 0.85, 0.6, '#ffffff'), GRASS_TOP_MATERIAL, STONE_BOTTOM_MATERIAL);
const SAND = pixelFaces(pixelMaterial(FISH_SAND_SIDE, 0, 0.9, 0.6, '#ffffff'), GRASS_TOP_MATERIAL, STONE_BOTTOM_MATERIAL);

const fishing: IslandDefinition = {
  label: '漁業の島',
  legend: {
    categoryLabels: {
      beauty: '釣り場',
      restaurant: '居酒屋',
      work: '魚市場',
      wedding: '休憩所',
      hospital: '釣り船',
      gym: '船着き場',
      travel: '水族館',
      school: '研究所',
    },
    description: '魚がいっぱいの島。釣りで獲った魚を売ったり、観察できる。海の幸に恵まれた漁業の島に変わりました。',
  },
  // 苔むした濃い岩と潮に洗われた砂岩。最上段は白い数字が読めるよう濃い岩
  blocks: (level, isTop) => {
    if (level === 0) return BLOCK_MATERIALS.shore;
    if (isTop) return ROCK;
    return level % 3 === 1 ? SAND : ROCK;
  },
  horizon: { day: '#bff0ff' },
  Decor: FishingDecor,
};

export const islands: Record<string, IslandDefinition> = { fishing };
