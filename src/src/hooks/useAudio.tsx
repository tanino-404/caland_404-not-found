import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { audioEngine, type AudioSettings, type BgmScene, type SeName } from '../lib/audio';

export interface AudioApi {
  settings: AudioSettings;
  /** 0〜1 */
  setBgmVolume: (value: number) => void;
  /** 0〜1 */
  setSeVolume: (value: number) => void;
  playBgm: (scene: BgmScene) => void;
  stopBgm: () => void;
  playSe: (name: SeName) => void;
  hasBgm: (scene: BgmScene) => boolean;
  unlock: () => void;
}

const AudioApiContext = createContext<AudioApi | null>(null);

export interface AudioProviderProps {
  children: ReactNode;
}

/**
 * BGM / SE を React から使うための Provider。アプリのルート（App の外側）に 1 つ置く。
 * - 最初の pointerdown / keydown で engine.unlock() を呼び、自動再生が止められていた BGM を鳴らす
 * - document の click を捕捉し、button 要素のクリックで「button」SE を鳴らす（data-no-se 付きは除く）
 */
export const AudioProvider = ({ children }: AudioProviderProps) => {
  const [settings, setSettings] = useState<AudioSettings>(() => audioEngine.getSettings());

  useEffect(() => {
    audioEngine.setVolumes(settings);
  }, [settings]);

  useEffect(() => {
    const onFirstInput = () => {
      audioEngine.unlock();
      remove();
    };
    const remove = () => {
      document.removeEventListener('pointerdown', onFirstInput);
      document.removeEventListener('keydown', onFirstInput);
    };
    document.addEventListener('pointerdown', onFirstInput);
    document.addEventListener('keydown', onFirstInput);
    return remove;
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button');
      if (button === null || button.disabled || button.hasAttribute('data-no-se')) return;
      audioEngine.playSe('button');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const setBgmVolume = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, bgmVolume: value }));
  }, []);
  const setSeVolume = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, seVolume: value }));
  }, []);
  const playBgm = useCallback((scene: BgmScene) => audioEngine.playBgm(scene), []);
  const stopBgm = useCallback(() => audioEngine.stopBgm(), []);
  const playSe = useCallback((name: SeName) => audioEngine.playSe(name), []);
  const hasBgm = useCallback((scene: BgmScene) => audioEngine.hasBgm(scene), []);
  const unlock = useCallback(() => audioEngine.unlock(), []);

  const api = useMemo<AudioApi>(
    () => ({ settings, setBgmVolume, setSeVolume, playBgm, stopBgm, playSe, hasBgm, unlock }),
    [settings, setBgmVolume, setSeVolume, playBgm, stopBgm, playSe, hasBgm, unlock],
  );

  return <AudioApiContext.Provider value={api}>{children}</AudioApiContext.Provider>;
};

export const useAudio = (): AudioApi => {
  const api = useContext(AudioApiContext);
  if (api === null) {
    throw new Error('useAudio は AudioProvider の中でだけ使えます');
  }
  return api;
};
