import type { IslandTheme } from '../types/island';
import type { PluginManifest } from '../types/plugins';

/**
 * 目標達成エフェクトの島の土台。plugin.json の effects[].theme → 島の見た目。
 * 土台の上に重ねるボクセルの絵（effects[].scene）は components/month/EffectSprites.tsx が描く。
 * 新しい土台を作るときは、IslandTheme を増やして 3D 側の表現を実装し、ここと server/plugins.py の BUILTIN_THEMES に足す。
 */
export const EFFECT_THEMES: Record<string, IslandTheme> = {
  plain: 'plain',
  luxury: 'luxury',
  muscle: 'muscle',
  library: 'library',
};

export const islandThemeFor = (effect: string): IslandTheme => {
  const theme = EFFECT_THEMES[effect];
  if (theme === undefined) {
    throw new Error(`effects: 実装されていないエフェクトです: ${effect}（EFFECT_THEMES に追加してください）`);
  }
  return theme;
};

/** 読み込んだプラグインのエフェクトがすべて実装済みかを先に確かめる */
export const assertKnownEffects = (manifest: PluginManifest): void => {
  for (const effect of manifest.effects) {
    islandThemeFor(effect.theme);
  }
};
