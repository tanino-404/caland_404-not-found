import { BoxGeometry, MeshStandardMaterial } from 'three';
import { BLOCK_HEIGHT, TOWER_WIDTH } from '../../../lib/camera';
import { BLOCK_COLORS, type BlockKind } from './blockKinds';
import {
  LUXURY_GLASS_SIDE,
  LUXURY_SHORE_SIDE,
  LUXURY_STONE_SIDE,
  LUXURY_TOP,
} from './luxuryTextures';
import { GYM_GRASS_TOP, GYM_SLATE_SIDE, GYM_STONE_SIDE } from './gymTextures';
import { LIB_GRAY_SIDE, LIB_LIME_SIDE } from './libraryTextures';

/** 積むブロック 1 個の形。年ビューの InstancedMesh も同じものを使う */
export const BLOCK_GEOMETRY = new BoxGeometry(TOWER_WIDTH, BLOCK_HEIGHT, TOWER_WIDTH);

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

interface PixelTexture {
  map: MeshStandardMaterial['map'];
  glow: MeshStandardMaterial['emissiveMap'];
}

/** ドット絵の面。金の縁だけ emissiveMap で少し光らせる */
const pixel = (texture: PixelTexture, metalness: number, roughness: number, glow: number): MeshStandardMaterial =>
  new MeshStandardMaterial({
    map: texture.map,
    emissiveMap: texture.glow,
    emissive: '#ffd36a',
    emissiveIntensity: glow,
    metalness,
    roughness,
  });

const pixelFaces = (side: MeshStandardMaterial, top: MeshStandardMaterial, bottom: MeshStandardMaterial) => [
  side,
  side,
  top,
  bottom,
  side,
  side,
];

const LUXURY_TOP_MAT = pixel(LUXURY_TOP, 0.35, 0.35, 0.18);
const LUXURY_BOTTOM_MAT = standard('#1e1d25');
const GYM_TOP_MAT = pixel(GYM_GRASS_TOP, 0, 0.95, 0);
const GYM_BOTTOM_MAT = standard('#5f646c');

/** ブロック種別 → 材質（6 面）。年ビューの InstancedMesh も同じものを使う */
export const BLOCK_MATERIALS: Record<BlockKind, MeshStandardMaterial | MeshStandardMaterial[]> = {
  grass: sixFaces(BLOCK_COLORS.dirt, BLOCK_COLORS.grassTop, BLOCK_COLORS.dirtDark),
  shore: sixFaces(BLOCK_COLORS.sand, BLOCK_COLORS.grassTop, BLOCK_COLORS.sandDark),
  dirt: standard(BLOCK_COLORS.dirt),
  stone: sixFaces(BLOCK_COLORS.stoneDark, BLOCK_COLORS.stone, BLOCK_COLORS.stoneDark),
  snow: sixFaces(BLOCK_COLORS.snowSide, BLOCK_COLORS.snow, BLOCK_COLORS.snowSide),
  goldShore: pixelFaces(pixel(LUXURY_SHORE_SIDE, 0.2, 0.6, 0.25), LUXURY_TOP_MAT, standard(BLOCK_COLORS.sandDark)),
  luxuryStone: pixelFaces(pixel(LUXURY_STONE_SIDE, 0.3, 0.45, 0.45), LUXURY_TOP_MAT, LUXURY_BOTTOM_MAT),
  luxuryGlass: pixelFaces(pixel(LUXURY_GLASS_SIDE, 0.55, 0.15, 0.4), LUXURY_TOP_MAT, LUXURY_BOTTOM_MAT),
  gymStone: pixelFaces(pixel(GYM_STONE_SIDE, 0.05, 0.85, 0.35), GYM_TOP_MAT, GYM_BOTTOM_MAT),
  gymSlate: pixelFaces(pixel(GYM_SLATE_SIDE, 0.05, 0.8, 0.35), GYM_TOP_MAT, GYM_BOTTOM_MAT),
  libLime: pixelFaces(pixel(LIB_LIME_SIDE, 0, 0.9, 0), GYM_TOP_MAT, GYM_BOTTOM_MAT),
  libGray: pixelFaces(pixel(LIB_GRAY_SIDE, 0, 0.9, 0), GYM_TOP_MAT, GYM_BOTTOM_MAT),
};
