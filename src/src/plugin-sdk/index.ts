/**
 * プラグイン用 SDK。plugins/<id>/island.tsx とその部品は、画面のコードをここ（`@plugin-sdk`）からだけ使う。
 * react / three / @react-three/fiber はそのまま import してよい（画面と同じものが使われる。vite.config.ts の dedupe）。
 * 書き方は plugins/README.md の「島（island.tsx）」。
 */

// ---------- 型 ----------
export type {
  BlockMaterial,
  IslandDecorProps,
  IslandDefinition,
  IslandFxProps,
  IslandModule,
  IslandRooftopProps,
} from '../types/island';
export type { EventCategory } from '../types/calendar';
export type { DayPhase } from '../types/weather';

// ---------- 島の寸法 ----------
export { BLOCK_HEIGHT, SEA_Y, TOWER_WIDTH, WATER_TOP_Y, colToX, rowToZ, towerTopY } from '../lib/camera';

// ---------- ボクセルとドット絵 ----------
export { Voxel } from '../components/models/Voxel';
export { GoldVoxel } from '../components/models/GoldVoxel';
export { UNIT_BOX, materialFor, materialForMetal } from '../components/models/materials';
export { pixelArtGeometry } from '../components/models/pixelArt';
export { type PixelTexture, type SetPixel, noise, paintPixels } from '../components/models/blocks/pixelTexture';

// ---------- 塔のブロック ----------
export {
  BLOCK_MATERIALS,
  GRASS_TOP_MATERIAL,
  STONE_BOTTOM_MATERIAL,
  pixelFaces,
  pixelMaterial,
  standardMaterial,
} from '../components/models/blocks/blockMaterials';

// ---------- 島の飾りによく使う小物 ----------
export { Palm } from '../components/models/Palm';
export { Clouds, FloatingIsland } from '../components/scenery/Sky';
export { Glow, LampPost, OakTree, WaterfallCliff } from '../components/scenery/Props';

// ---------- 空の演出（Fx） ----------
export { Glints, PixelRain, type RainItem, SunFlare } from '../components/month/SkyFx';
export { useSkyFade } from '../components/month/skyFade';
export { type Faller, buildFallers, unit } from '../components/month/fallers';
