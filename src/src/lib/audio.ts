/**
 * BGM / SE の再生エンジン。React に依存しない。アプリ全体で `audioEngine` を 1 つ使う。
 *
 * 音声ファイルは Vite プロジェクトルート直下の `audio/` に置く（`src/audio/`。`src/src/` ではない）。
 * フォルダ名が用途（BgmScene / SeName）で、中に mp3 が 0〜複数ある。
 *   audio/bgm/<scene>/*.mp3
 *   audio/se/<name>/*.mp3
 * 複数曲あるときは、画面に入るたびにランダムに 1 曲。曲が終わったら次もランダム（同じ曲を続けない）。
 */

export type BgmScene =
  | 'opening'
  | 'loading_main'
  | 'main'
  | 'setting'
  | 'loading_friend'
  | 'friend'
  | 'management';

export type SeName = 'opening_click' | 'login' | 'button' | 'management' | 'logout';

/** 音量は 0〜1 */
export interface AudioSettings {
  bgmVolume: number;
  seVolume: number;
}

const BGM_SCENES: readonly BgmScene[] = [
  'opening',
  'loading_main',
  'main',
  'setting',
  'loading_friend',
  'friend',
  'management',
];

const SE_NAMES: readonly SeName[] = ['opening_click', 'login', 'button', 'management', 'logout'];

const STORAGE_KEY = 'caland-audio';
const STORAGE_VERSION = 1;
const DEFAULT_SETTINGS: AudioSettings = { bgmVolume: 0.5, seVolume: 0.7 };

/** フェードの長さと刻み */
const FADE_MS = 600;
const FADE_STEP_MS = 50;

/* ---------- ファイル一覧：Vite の import.meta.glob。`/` 始まりはプロジェクトルート（= src/） ---------- */

const BGM_URLS_BY_PATH = import.meta.glob<string>('/audio/bgm/*/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

const SE_URLS_BY_PATH = import.meta.glob<string>('/audio/se/*/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** `/audio/bgm/main/曲.mp3` のようなキーから、用途のフォルダ名 `main` を取り出す */
const folderOf = (path: string): string => {
  const parts = path.split('/');
  if (parts.length < 2) {
    throw new Error(`audio: パスの形式が不正です: ${path}`);
  }
  return parts[parts.length - 2];
};

/** キーのフォルダ名で分類する。知らないフォルダ名があれば置き場の間違いなので止める */
const groupByFolder = <K extends string>(
  urlsByPath: Record<string, string>,
  known: readonly K[],
  label: string,
): Record<K, string[]> => {
  const grouped = {} as Record<K, string[]>;
  for (const key of known) grouped[key] = [];
  const isKnown = (folder: string): folder is K => (known as readonly string[]).includes(folder);
  for (const [path, url] of Object.entries(urlsByPath)) {
    const folder = folderOf(path);
    if (!isKnown(folder)) {
      throw new Error(
        `audio: ${label} に知らないフォルダ "${folder}" があります（${path}）。使えるのは ${known.join(', ')}`,
      );
    }
    grouped[folder].push(url);
  }
  for (const key of known) grouped[key].sort();
  return grouped;
};

export const BGM_URLS: Record<BgmScene, string[]> = groupByFolder(BGM_URLS_BY_PATH, BGM_SCENES, 'audio/bgm');
export const SE_URLS: Record<SeName, string[]> = groupByFolder(SE_URLS_BY_PATH, SE_NAMES, 'audio/se');

/* ---------- 小さな道具 ---------- */

const clampVolume = (value: number): number => {
  if (!Number.isFinite(value)) {
    throw new Error(`audio: 音量が数値ではありません: ${String(value)}`);
  }
  return Math.min(1, Math.max(0, value));
};

/** list からランダムに 1 つ。avoid と同じものは避ける（1 つしか無ければそれ） */
const pickRandom = (list: readonly string[], avoid: string | null): string => {
  if (list.length === 0) {
    throw new Error('audio: 候補が空です');
  }
  const candidates = list.length > 1 && avoid !== null ? list.filter((url) => url !== avoid) : list;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

const isNotAllowedError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'NotAllowedError';

const loadSettings = (): AudioSettings => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return DEFAULT_SETTINGS;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error(`audio: 保存データの形式が不正です: ${raw.slice(0, 80)}`);
  }
  if ((parsed as { version: unknown }).version !== STORAGE_VERSION) {
    return DEFAULT_SETTINGS;
  }
  const { bgmVolume, seVolume } = parsed as Record<string, unknown>;
  if (typeof bgmVolume !== 'number' || typeof seVolume !== 'number') {
    throw new Error(`audio: 音量の形式が不正です: ${raw.slice(0, 80)}`);
  }
  return { bgmVolume: clampVolume(bgmVolume), seVolume: clampVolume(seVolume) };
};

const saveSettings = (settings: AudioSettings): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...settings }));
};

/* ---------- 再生中の BGM 1 本ぶんの状態 ---------- */

interface Track {
  scene: BgmScene;
  url: string;
  element: HTMLAudioElement;
  /** フェード中の setInterval の id。フェードしていなければ null */
  fadeTimer: number | null;
}

/* ---------- エンジン ---------- */

export class AudioEngine {
  private settings: AudioSettings = loadSettings();
  /** 今鳴っている（またはフェードインしている）BGM */
  private current: Track | null = null;
  /** フェードアウト中の BGM。終わったら消す */
  private fadingOut: Track[] = [];
  /** 用途ごとに、最後に流した曲。次に同じ曲を続けないため */
  private lastUrlByScene: Partial<Record<BgmScene, string>> = {};
  /** 自動再生がブラウザに止められた用途。unlock() で再生する */
  private pendingScene: BgmScene | null = null;

  hasBgm(scene: BgmScene): boolean {
    return BGM_URLS[scene].length > 0;
  }

  /**
   * その用途の曲をランダムに 1 曲流す。鳴っている BGM はフェードアウトし、新しい曲をフェードインする。
   * 同じ用途を続けて要求されたら何もしない。用途に曲が無ければ何もしない（呼び出し側は hasBgm で判断する）。
   */
  playBgm(scene: BgmScene): void {
    if (!this.hasBgm(scene)) return;
    if (this.current?.scene === scene || this.pendingScene === scene) return;
    this.pendingScene = null;
    this.releaseCurrent();
    this.startTrack(scene);
  }

  /** フェードアウトして止める */
  stopBgm(): void {
    this.pendingScene = null;
    this.releaseCurrent();
  }

  /** 効果音を 1 つ鳴らす。都度 Audio を作るので重なってよい。音が無ければ何もしない */
  playSe(name: SeName): void {
    const urls = SE_URLS[name];
    if (urls.length === 0) return;
    const element = new Audio(pickRandom(urls, null));
    element.volume = clampVolume(this.settings.seVolume);
    element.play().catch((err: unknown) => {
      if (isNotAllowedError(err)) {
        // ユーザー操作より前に鳴らそうとした。SE は後から鳴らしても意味が無いので見送る
        console.warn(`audio: SE "${name}" はユーザー操作前のため再生できませんでした`);
        return;
      }
      console.error(`audio: SE "${name}" の再生に失敗しました`, err);
    });
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /** 音量を変えて保存する。BGM は再生中の要素にも即反映する */
  setVolumes(settings: AudioSettings): void {
    this.settings = { bgmVolume: clampVolume(settings.bgmVolume), seVolume: clampVolume(settings.seVolume) };
    saveSettings(this.settings);
    const track = this.current;
    if (track !== null && track.fadeTimer === null) {
      track.element.volume = this.settings.bgmVolume;
    }
  }

  /** 最初のユーザー操作で呼ぶ。自動再生が止められていた BGM を再生する */
  unlock(): void {
    const scene = this.pendingScene;
    if (scene === null) return;
    this.pendingScene = null;
    this.startTrack(scene);
  }

  /* ---------- 内部 ---------- */

  /** 用途の曲を 1 つ選んで再生を始め、フェードインする */
  private startTrack(scene: BgmScene): void {
    const url = pickRandom(BGM_URLS[scene], this.lastUrlByScene[scene] ?? null);
    this.lastUrlByScene[scene] = url;
    const element = new Audio(url);
    element.volume = 0;
    const track: Track = { scene, url, element, fadeTimer: null };
    this.current = track;

    element.addEventListener('ended', () => {
      // 曲が終わったら、同じ用途の次の曲をランダムに（今の曲は避ける）
      if (this.current !== track) return;
      this.startTrack(scene);
    });

    element.play().then(
      () => {
        if (this.current !== track) return;
        this.fade(track, () => this.settings.bgmVolume);
      },
      (err: unknown) => {
        // 再生が始まる前に別の用途へ切り替えた（pause による中断）。想定どおりなので何もしない
        if (this.current !== track) return;
        this.current = null;
        if (isNotAllowedError(err)) {
          // ユーザー操作前の自動再生はブラウザが止める。unlock() で再生する
          this.pendingScene = scene;
          return;
        }
        console.error(`audio: BGM "${scene}" (${url}) の再生に失敗しました`, err);
      },
    );
  }

  /** 今の BGM をフェードアウトして捨てる */
  private releaseCurrent(): void {
    const track = this.current;
    if (track === null) return;
    this.current = null;
    this.fadingOut.push(track);
    this.fade(
      track,
      () => 0,
      () => {
        track.element.pause();
        this.fadingOut = this.fadingOut.filter((t) => t !== track);
      },
    );
  }

  /** 今の音量から target() まで FADE_MS かけて補間する。target は毎回読むので、途中で音量を変えても追従する */
  private fade(track: Track, target: () => number, onDone?: () => void): void {
    this.clearFade(track);
    const from = track.element.volume;
    const startedAt = performance.now();
    track.fadeTimer = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - startedAt) / FADE_MS);
      track.element.volume = clampVolume(from + (target() - from) * t);
      if (t >= 1) {
        this.clearFade(track);
        onDone?.();
      }
    }, FADE_STEP_MS);
  }

  private clearFade(track: Track): void {
    if (track.fadeTimer === null) return;
    window.clearInterval(track.fadeTimer);
    track.fadeTimer = null;
  }
}

export const audioEngine = new AudioEngine();
