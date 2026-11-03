import { useState, type KeyboardEvent } from 'react';
import { useAudio } from '../../hooks/useAudio';
import { memberColor } from '../../lib/members';
import { WEATHER_LABELS, type DayPhase, type WeatherCondition } from '../../types/weather';
import { IconSettings } from './icons';
import './SettingsScreen.css';

export interface SettingsScreenProps {
  currentUser: string;
  members: string[];
  /** 0〜1 */
  bgmVolume: number;
  /** 0〜1 */
  seVolume: number;
  onBgmVolume: (value: number) => void;
  onSeVolume: (value: number) => void;
  onReset: () => Promise<void>;
  onBack: () => void;
  /** デバッグモード：ON のあいだ、天気と時刻帯を実際の値の代わりにここで選んだものにする */
  debug: WeatherDebug;
  onDebug: (next: WeatherDebug) => void;
}

/** 天気と時刻帯のデバッグ指定 */
export interface WeatherDebug {
  enabled: boolean;
  condition: WeatherCondition;
  dayPhase: DayPhase;
}

const DEBUG_CONDITIONS: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'snow', 'thunder'];
const DEBUG_PHASES: { id: DayPhase; label: string }[] = [
  { id: 'day', label: '昼' },
  { id: 'evening', label: '夕方' },
  { id: 'night', label: '夜' },
];

/* ---------- デバッグモード：トグルと選択チップ ---------- */

interface DebugPanelProps {
  debug: WeatherDebug;
  onDebug: (next: WeatherDebug) => void;
}

const DebugPanel = ({ debug, onDebug }: DebugPanelProps) => (
  <div className="settings-debug">
    <div className="settings-debug-row">
      <span className="settings-slider-label" id="settings-debug-label">
        デバッグモード
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={debug.enabled}
        aria-labelledby="settings-debug-label"
        className={debug.enabled ? 'mc-toggle is-on' : 'mc-toggle'}
        onClick={() => onDebug({ ...debug, enabled: !debug.enabled })}
      >
        <span className="mc-toggle-knob" />
        <span className="mc-toggle-text">{debug.enabled ? 'ON' : 'OFF'}</span>
      </button>
    </div>
    {debug.enabled ? (
      <>
        <div className="settings-debug-row" role="radiogroup" aria-label="天気">
          <span className="settings-debug-key">天気</span>
          {DEBUG_CONDITIONS.map((condition) => (
            <button
              key={condition}
              type="button"
              role="radio"
              aria-checked={debug.condition === condition}
              className={debug.condition === condition ? 'mc-chip is-selected' : 'mc-chip'}
              onClick={() => onDebug({ ...debug, condition })}
            >
              {WEATHER_LABELS[condition]}
            </button>
          ))}
        </div>
        <div className="settings-debug-row" role="radiogroup" aria-label="時刻帯">
          <span className="settings-debug-key">時刻帯</span>
          {DEBUG_PHASES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={debug.dayPhase === id}
              className={debug.dayPhase === id ? 'mc-chip is-selected' : 'mc-chip'}
              onClick={() => onDebug({ ...debug, dayPhase: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="settings-note">ON のあいだは実際の天気と時刻の代わりに、ここで選んだものを 3D と空に反映します。</p>
      </>
    ) : null}
  </div>
);

/* ---------- 音量スライダー：マイクラのオプション画面のスライダー ---------- */

interface VolumeSliderProps {
  id: string;
  label: string;
  /** 0〜1 */
  value: number;
  onChange: (value: number) => void;
  /** つまみを離したとき（試聴用）。省略可 */
  onRelease?: () => void;
}

/** キーボードでつまみを動かすキー。離したときに試聴する */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

const VolumeSlider = ({ id, label, value, onChange, onRelease }: VolumeSliderProps) => {
  const percent = Math.round(value * 100);
  const onKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (SLIDER_KEYS.has(event.key)) onRelease?.();
  };
  return (
    <div className="settings-slider">
      <label htmlFor={id} className="settings-slider-label">
        {label}
      </label>
      <input
        id={id}
        className="mc-slider"
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={(event) => onChange(Number(event.currentTarget.value) / 100)}
        onPointerUp={onRelease}
        onKeyUp={onKeyUp}
      />
      <output htmlFor={id} className="settings-slider-value">
        {percent}%
      </output>
    </div>
  );
};

/* ---------- 背景：16×16 の土ブロック（マイクラのオプション画面の暗いタイル） ---------- */

const DIRT_ROWS = [
  'aaabaaaaabbaaaca',
  'abaaacaabaaaaaab',
  'aaaaaaaaaaacaaaa',
  'aacaabbaaaaaabaa',
  'baaaaaaaacaaaaaa',
  'aaabaaaaaaaabaaa',
  'aaaaacaabaaaaaac',
  'abaaaaaaaaabaaaa',
  'aaaacaabbaaaaaba',
  'caaaaaaaaaacaaaa',
  'aabaaacaaaaaaaab',
  'aaaaaaaaabaaaaaa',
  'aacaabaaaaaacaaa',
  'baaaaaaacaabaaaa',
  'aaabaaaaaaaaaaab',
  'aaaaacaabaaacaaa',
] as const;

/** 明るさを 0.45 相当に落とした土の色 */
const DIRT_PALETTE: Record<string, string> = { a: '#3e2914', b: '#2e1d0d', c: '#4a331a' };

/** 行の文字列を rect に変換し、SVG の data URI にする（CSS の background-image 用） */
const buildDirtTile = (): string => {
  const rects: string[] = [];
  DIRT_ROWS.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const fill = DIRT_PALETTE[ch];
      if (fill === undefined) {
        throw new Error(`SettingsScreen: palette に "${ch}" がありません（${y} 行目）`);
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`);
      x = end;
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects.join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const DIRT_TILE = buildDirtTile();

/** 設定画面。3D は見せず、暗い土ブロックのタイルの上に「設定」の見出しと看板パネルを置く。 */
export const SettingsScreen = ({
  currentUser,
  members,
  bgmVolume,
  seVolume,
  onBgmVolume,
  onSeVolume,
  onReset,
  onBack,
  debug,
  onDebug,
}: SettingsScreenProps) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // スライダーは button ではないので Provider の click 捕捉では鳴らない。試聴は自前で鳴らす
  const { playSe } = useAudio();

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings">
      <div className="settings-bg" style={{ backgroundImage: DIRT_TILE }} aria-hidden="true" />

      <div className="settings-body">
        <h1 id="settings-title" className="settings-title">
          <IconSettings size={36} />
          設定
        </h1>

        <section className="settings-panel panel" aria-labelledby="settings-title">
          <dl className="settings-user">
            <dt>ログイン中</dt>
            <dd>
              <span className="chip" style={{ background: memberColor(members, currentUser) }} />
              {currentUser}
            </dd>
          </dl>

          <div className="settings-audio">
            <VolumeSlider id="settings-bgm-volume" label="BGM 音量" value={bgmVolume} onChange={onBgmVolume} />
            <VolumeSlider
              id="settings-se-volume"
              label="SE 音量"
              value={seVolume}
              onChange={onSeVolume}
              onRelease={() => playSe('button')}
            />
          </div>

          <DebugPanel debug={debug} onDebug={onDebug} />

          <div className="settings-actions">
            <button
              type="button"
              className="mc-btn mc-btn-danger"
              disabled={busy}
              onClick={() => void run(onReset)}
            >
              {busy ? '…' : '保存したデータを消してサンプルに戻す'}
            </button>
            <p className="settings-note">予定・家計簿・メンバーを初期状態に戻します。</p>
          </div>

          {error !== null ? (
            <p className="ledger-status settings-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="button" className="mc-btn settings-back" onClick={onBack}>
            ◀ メインに戻る
          </button>
        </section>
      </div>
    </div>
  );
};
