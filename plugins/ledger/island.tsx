import {
  type IslandDefinition,
  pixelFaces,
  pixelMaterial,
  standardMaterial,
} from '@plugin-sdk';
import { GoldLights, LuxuryDecor } from './parts/LuxuryDecor';
import { LuxuryFx } from './parts/LuxuryFx';
import { LuxuryRooftop } from './parts/LuxuryRooftop';
import { LUXURY_GLASS_SIDE, LUXURY_SHORE_SIDE, LUXURY_STONE_SIDE, LUXURY_TOP } from './parts/luxuryTextures';
import './island.css';

/**
 * 黄金郷：砂金の浜と、金で縁取った黒曜石の塔。高い塔は途中がガラス張り。屋上にプールやヤシ、空から金貨。
 * NISA も plugin.json の theme「ledger/luxury」でこの島を使う。
 */

const TOP = pixelMaterial(LUXURY_TOP, 0.35, 0.35, 0.18);
const BOTTOM = standardMaterial('#1e1d25');
const SHORE = pixelFaces(pixelMaterial(LUXURY_SHORE_SIDE, 0.2, 0.6, 0.25), TOP, standardMaterial('#d3c288'));
const STONE = pixelFaces(pixelMaterial(LUXURY_STONE_SIDE, 0.3, 0.45, 0.45), TOP, BOTTOM);
const GLASS = pixelFaces(pixelMaterial(LUXURY_GLASS_SIDE, 0.55, 0.15, 0.4), TOP, BOTTOM);

const luxury: IslandDefinition = {
  label: '黄金郷',
  blocks: (level, isTop) => {
    if (level === 0) return SHORE;
    if (isTop) return STONE;
    return level >= 3 && level % 2 === 1 ? GLASS : STONE;
  },
  blocksInYear: true,
  water: { color: '#4fc2f0', roughness: 0.18, metalness: 0.25, opacity: 0.62 },
  villagers: {
    shirts: ['#ffd24a', '#fff4c2', '#e23d4f', '#7ec8e8', '#3ecf6e'],
    pants: ['#5a3a10', '#3a2208', '#7a1d2e'],
  },
  horizon: { day: '#b8e8ff', evening: '#ffd0a4', night: '#344b7c' },
  Lights: GoldLights,
  Decor: LuxuryDecor,
  Fx: LuxuryFx,
  Rooftop: LuxuryRooftop,
};

export const islands: Record<string, IslandDefinition> = { luxury };
