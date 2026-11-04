import type { Island, IslandModule } from '../types/island';
import type { PluginManifest } from '../types/plugins';

/**
 * プラグインの島（plugins/<id>/island.tsx）の読み込み。
 * Vite がビルド時（開発サーバーではファイルを足した時点）に plugins/ 以下を見つけて、島ごとに別のチャンクにする。
 * 読み込むのはインストール済みのプラグインを表示したときだけ（hooks/usePlugin.ts が loadIslandsFor を呼ぶ）。
 */

export const PLAIN_THEME = 'plain';

const loaders = import.meta.glob<IslandModule>('../../../plugins/*/island.tsx');

const loaderFor = (pluginId: string): (() => Promise<IslandModule>) => {
  const loader = loaders[`../../../plugins/${pluginId}/island.tsx`];
  if (loader === undefined) {
    throw new Error(`islands: plugins/${pluginId}/island.tsx がありません（画面を再読み込みすると見つかる場合があります）`);
  }
  return loader;
};

/** 読み込み済みの島。key は「<プラグイン id>/<島の名前>」 */
const loaded = new Map<string, Island>();
const loadedPlugins = new Set<string>();

/** effect.theme → 島の key。plain は null */
export const islandKeyOf = (manifest: PluginManifest, theme: string): string | null => {
  if (theme === PLAIN_THEME) return null;
  if (theme.includes('/')) return theme;
  if (!(manifest.islands ?? []).includes(theme)) {
    throw new Error(`islands: ${manifest.id} の theme ${theme} が plugin.json の islands にありません`);
  }
  return `${manifest.id}/${theme}`;
};

const loadPlugin = async (pluginId: string): Promise<void> => {
  if (loadedPlugins.has(pluginId)) return;
  const module = await loaderFor(pluginId)();
  for (const [name, definition] of Object.entries(module.islands)) {
    const key = `${pluginId}/${name}`;
    loaded.set(key, { ...definition, key, pluginId, name });
  }
  loadedPlugins.add(pluginId);
};

/** このプラグインの effects が使う島のコードをすべて読み込む（ほかのプラグインから借りた島も） */
export const loadIslandsFor = async (manifest: PluginManifest): Promise<void> => {
  const keys = manifest.effects.flatMap((effect) => {
    const key = islandKeyOf(manifest, effect.theme);
    return key === null ? [] : [key];
  });
  await Promise.all([...new Set(keys.map((key) => key.split('/')[0]))].map(loadPlugin));
  for (const key of keys) {
    if (!loaded.has(key)) {
      throw new Error(`islands: plugins/${key.split('/')[0]}/island.tsx の islands に ${key.split('/')[1]} がありません`);
    }
  }
};

/** effect.theme の島。plain は null。先に loadIslandsFor で読み込んでおく */
export const islandFor = (manifest: PluginManifest, theme: string): Island | null => {
  const key = islandKeyOf(manifest, theme);
  return key === null ? null : islandByKey(key);
};

export const islandByKey = (key: string): Island => {
  const island = loaded.get(key);
  if (island === undefined) {
    throw new Error(`islands: 島 ${key} がまだ読み込まれていません`);
  }
  return island;
};

/** これまでに読み込んだ島。月を送って島が変わっても空の演出（Fx）をフェードアウトさせるため、全部をいつも置いておく */
export const loadedIslands = (): Island[] => [...loaded.values()];
