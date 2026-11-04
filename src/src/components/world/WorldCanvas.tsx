import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { type AmbientLight, Color, type DirectionalLight, Fog, type HemisphereLight, Vector3 } from 'three';
import type { CameraPose } from '../../lib/camera';
import type { Island } from '../../types/island';
import type { EffectScene } from '../../types/plugins';
import type { DayPhase, WeatherCondition } from '../../types/weather';
import { type CameraSnap, CameraRig } from '../month/CameraRig';
import { Sea } from '../month/Sea';

/**
 * 時刻帯ごとの地平（fog）色。晴れのときの値。島が horizon を持っていればそちらを使う。
 * body の空グラデーション（sky-day / sky-evening / sky-night）の下端色はこれに合わせてある
 */
const HORIZON_BY_PHASE: Record<DayPhase, string> = {
  day: '#cfeeff',
  evening: '#ffc4a0',
  night: '#2a3f6a',
};

/** 天気で地平色に混ぜる色と割合。clear は混ぜない */
const HORIZON_WEATHER_TINT: Record<WeatherCondition, { color: string; amount: number }> = {
  clear: { color: '#ffffff', amount: 0 },
  cloudy: { color: '#b4bcc6', amount: 0.45 },
  rain: { color: '#7d8894', amount: 0.6 },
  thunder: { color: '#5e6874', amount: 0.65 },
  snow: { color: '#f2f5f8', amount: 0.45 },
};

/**
 * fog が実際に目標にする地平色（テーマ × 時刻帯 × 天気）。CSS の空色を天気まで合わせたいときに使う。
 * プラグインのエフェクトが地平色（scene.horizon）を持つときは、昼の色をそれに置き換える
 */
const horizonColorFor = (
  island: Island | null,
  dayPhase: DayPhase,
  weather: WeatherCondition,
  sceneHorizon: string | null,
): string => {
  const tint = HORIZON_WEATHER_TINT[weather];
  const base =
    dayPhase === 'day' && sceneHorizon !== null
      ? sceneHorizon
      : (island?.horizon?.[dayPhase] ?? HORIZON_BY_PHASE[dayPhase]);
  const color = new Color(base).lerp(new Color(tint.color), tint.amount);
  return `#${color.getHexString()}`;
};

/** fog の範囲。near = 月ビュー（島 1 つ）、wide = 年ビュー全体（島 12 個）が入る範囲 */
export type FogRange = 'near' | 'wide';

const FOG_DISTANCE: Record<FogRange, [near: number, far: number]> = {
  near: [18, 44],
  wide: [40, 110],
};

/** wide では海の遠景板（一辺 160）の端まで描けるようカメラの far を伸ばす */
const CAMERA_FAR: Record<FogRange, number> = {
  near: 120,
  wide: 200,
};

const INITIAL_CAMERA_POSITION: [number, number, number] = [3.2, 11, 11.5];

/** Canvas の camera prop は生成時にしか効かないので、fogRange が変わったら far を更新する */
const CameraFar = ({ far }: { far: number }) => {
  useFrame(({ camera }) => {
    if (camera.far === far) return;
    camera.far = far;
    camera.updateProjectionMatrix();
  });
  return null;
};

/** テーマごとの基準ライト（day × clear のときの値） */
interface ThemeLighting {
  ambientColor: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
}

/** 達成した島（プラグインの島）は空ごと明るくする */
const BRIGHT_LIGHTING: ThemeLighting = {
  ambientColor: '#fff8ee',
  ambientIntensity: 0.78,
  hemiSky: '#c8f0ff',
  hemiGround: '#f0d9a0',
  hemiIntensity: 1.15,
  sunColor: '#fff5d6',
  sunIntensity: 1.55,
};

const PLAIN_LIGHTING: ThemeLighting = {
  ambientColor: '#fff8ee',
  ambientIntensity: 0.55,
  hemiSky: '#dff3ff',
  hemiGround: '#c9b48a',
  hemiIntensity: 0.9,
  sunColor: '#fff1d6',
  sunIntensity: 1.1,
};

/** 時刻帯で基準ライトにかける係数と、寄せる色 */
interface PhaseLighting {
  /** ambient / hemisphere / directional の強さにかける */
  light: number;
  ambientTint: string;
  ambientTintAmount: number;
  skyTint: string;
  skyTintAmount: number;
  groundTint: string;
  groundTintAmount: number;
  sunTint: string;
  sunTintAmount: number;
  sunPosition: [number, number, number];
}

const PHASE_LIGHTING: Record<DayPhase, PhaseLighting> = {
  day: {
    light: 1,
    ambientTint: '#ffffff',
    ambientTintAmount: 0,
    skyTint: '#ffffff',
    skyTintAmount: 0,
    groundTint: '#ffffff',
    groundTintAmount: 0,
    sunTint: '#ffffff',
    sunTintAmount: 0,
    sunPosition: [6, 12, 4],
  },
  evening: {
    light: 0.9,
    ambientTint: '#ffd9a0',
    ambientTintAmount: 0.65,
    skyTint: '#ffb48a',
    skyTintAmount: 0.6,
    groundTint: '#c98a5a',
    groundTintAmount: 0.4,
    sunTint: '#ffb070',
    sunTintAmount: 0.75,
    sunPosition: [13, 4.5, 3],
  },
  night: {
    light: 0.42,
    ambientTint: '#9fb7ff',
    ambientTintAmount: 0.85,
    skyTint: '#3d5390',
    skyTintAmount: 0.85,
    groundTint: '#1f2a44',
    groundTintAmount: 0.8,
    sunTint: '#9fb7ff',
    sunTintAmount: 0.9,
    sunPosition: [-5, 9, 6],
  },
};

/** 天気で光にかける係数 */
interface WeatherLighting {
  sun: number;
  ambient: number;
  /** hemisphere の空色を灰色（snow は白）へ寄せる割合 */
  skyGreyAmount: number;
  skyGrey: string;
  /** fog の near にかける（雨・雷は近くまで霞む） */
  fogNear: number;
}

const WEATHER_LIGHTING: Record<WeatherCondition, WeatherLighting> = {
  clear: { sun: 1, ambient: 1, skyGreyAmount: 0, skyGrey: '#b9c2cc', fogNear: 1 },
  cloudy: { sun: 0.7, ambient: 1, skyGreyAmount: 0.5, skyGrey: '#b9c2cc', fogNear: 1 },
  rain: { sun: 0.42, ambient: 0.85, skyGreyAmount: 0.7, skyGrey: '#8d97a3', fogNear: 0.8 },
  thunder: { sun: 0.42, ambient: 0.8, skyGreyAmount: 0.75, skyGrey: '#7a848f', fogNear: 0.8 },
  snow: { sun: 0.7, ambient: 1, skyGreyAmount: 0.45, skyGrey: '#eef2f6', fogNear: 1 },
};

/** useFrame が毎フレーム近づける目標値。props が変わったときだけ作り直す */
interface LightTarget {
  ambientColor: Color;
  ambientIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  sunColor: Color;
  sunIntensity: number;
  sunPosition: Vector3;
  fogColor: Color;
  fogNear: number;
  fogFar: number;
}

const buildLightTarget = (
  island: Island | null,
  scene: EffectScene | null,
  dayPhase: DayPhase,
  weather: WeatherCondition,
  fogRange: FogRange,
): LightTarget => {
  const base = island === null ? PLAIN_LIGHTING : BRIGHT_LIGHTING;
  const phase = PHASE_LIGHTING[dayPhase];
  const sky = WEATHER_LIGHTING[weather];
  const [fogNear, fogFar] = FOG_DISTANCE[fogRange];

  return {
    ambientColor: new Color(scene?.ambient ?? base.ambientColor).lerp(
      new Color(phase.ambientTint),
      phase.ambientTintAmount,
    ),
    ambientIntensity: base.ambientIntensity * phase.light * sky.ambient,
    hemiSky: new Color(base.hemiSky)
      .lerp(new Color(phase.skyTint), phase.skyTintAmount)
      .lerp(new Color(sky.skyGrey), sky.skyGreyAmount),
    hemiGround: new Color(base.hemiGround).lerp(new Color(phase.groundTint), phase.groundTintAmount),
    hemiIntensity: base.hemiIntensity * phase.light,
    sunColor: new Color(base.sunColor).lerp(new Color(phase.sunTint), phase.sunTintAmount),
    sunIntensity: base.sunIntensity * phase.light * sky.sun,
    sunPosition: new Vector3(...phase.sunPosition),
    fogColor: new Color(horizonColorFor(island, dayPhase, weather, scene?.horizon ?? null)),
    fogNear: fogNear * sky.fogNear,
    fogFar,
  };
};

/** 色・強さが目標へ寄る速さ（1/s）。約 1.2 秒で 95% */
const LIGHT_RATE = 2.5;
/** fog の near / far は雲の下でワールドを切り替えるので少し速く */
const FOG_RANGE_RATE = 4;

const approach = (current: number, target: number, alpha: number): number =>
  current + (target - current) * alpha;

interface SceneLightingProps {
  target: LightTarget;
}

/**
 * ライトと fog の実体。JSX には最初の目標値だけを渡し、以後は useFrame で現在値から目標値へ指数補間する
 * （JSX の属性を書き換えると R3F が即座に上書きして補間と喧嘩するため）
 */
const SceneLighting = ({ target }: SceneLightingProps) => {
  const [initial] = useState(target);
  const ambient = useRef<AmbientLight>(null);
  const hemisphere = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);

  useFrame(({ scene }, delta) => {
    const alpha = 1 - Math.exp(-delta * LIGHT_RATE);
    const fogAlpha = 1 - Math.exp(-delta * FOG_RANGE_RATE);

    const ambientLight = ambient.current;
    if (ambientLight) {
      ambientLight.color.lerp(target.ambientColor, alpha);
      ambientLight.intensity = approach(ambientLight.intensity, target.ambientIntensity, alpha);
    }

    const hemi = hemisphere.current;
    if (hemi) {
      hemi.color.lerp(target.hemiSky, alpha);
      hemi.groundColor.lerp(target.hemiGround, alpha);
      hemi.intensity = approach(hemi.intensity, target.hemiIntensity, alpha);
    }

    const sunLight = sun.current;
    if (sunLight) {
      sunLight.color.lerp(target.sunColor, alpha);
      sunLight.intensity = approach(sunLight.intensity, target.sunIntensity, alpha);
      sunLight.position.lerp(target.sunPosition, alpha);
    }

    const fog = scene.fog;
    if (!(fog instanceof Fog)) {
      throw new Error('WorldCanvas: scene.fog が Fog ではありません');
    }
    fog.color.lerp(target.fogColor, alpha);
    fog.near = approach(fog.near, target.fogNear, fogAlpha);
    fog.far = approach(fog.far, target.fogFar, fogAlpha);
  });

  return (
    <>
      <fog attach="fog" args={[initial.fogColor, initial.fogNear, initial.fogFar]} />
      <ambientLight ref={ambient} intensity={initial.ambientIntensity} color={initial.ambientColor} />
      <hemisphereLight
        ref={hemisphere}
        color={initial.hemiSky}
        groundColor={initial.hemiGround}
        intensity={initial.hemiIntensity}
      />
      <directionalLight
        ref={sun}
        position={initial.sunPosition}
        intensity={initial.sunIntensity}
        color={initial.sunColor}
      />
    </>
  );
};

export interface WorldCanvasProps {
  /** 目標を達成して変わった島。ライト・fog・海と、島が足すライト。いつもの島は null */
  island: Island | null;
  /** 表示中プラグインのエフェクトの空・地平・環境光の色。無ければ null */
  scene: EffectScene | null;
  fogRange: FogRange;
  /** 時刻帯。光の色・太陽の角度・fog 色を変える */
  dayPhase: DayPhase;
  /** 現在の天気。光の強さ・空色・fog の近さを変える */
  weather: WeatherCondition;
  /** CameraRig に渡す目標姿勢 */
  pose: CameraPose;
  /** 雲の下でワールドを切り替えるとき、カメラをここへ瞬間移動してから pose へ補間する。key が変わったときだけ発動 */
  snap: CameraSnap | null;
  /** タイトル画面でゆっくり回す */
  autoRotate: boolean;
  /** OrbitControls の最大距離（年ビューは遠くまで引けるように） */
  maxDistance: number;
  /** 島以外をクリックしたとき（ホバーの解除など） */
  onPointerMissed?: () => void;
  children: ReactNode;
}

/**
 * 1 つの WebGL コンテキストに月・年・タイトルのワールドを同時にマウントするための Canvas。
 * ライト・fog・海・カメラ制御はここが持ち、ワールドは children で渡す
 */
export const WorldCanvas = ({
  island,
  scene,
  fogRange,
  dayPhase,
  weather,
  pose,
  snap,
  autoRotate,
  maxDistance,
  onPointerMissed,
  children,
}: WorldCanvasProps) => {
  const target = useMemo(
    () => buildLightTarget(island, scene, dayPhase, weather, fogRange),
    [island, scene, dayPhase, weather, fogRange],
  );
  const Lights = island?.Lights;

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMappingExposure: island === null ? 0.95 : 1.12 }}
        camera={{ position: INITIAL_CAMERA_POSITION, fov: 40, near: 0.1, far: CAMERA_FAR[fogRange] }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.2, 0);
        }}
        onPointerMissed={onPointerMissed}
      >
        <CameraFar far={CAMERA_FAR[fogRange]} />
        {scene?.sky !== undefined ? <color attach="background" args={[scene.sky]} /> : null}
        <SceneLighting target={target} />
        {Lights !== undefined ? <Lights dayPhase={dayPhase} /> : null}

        <Sea island={island} />

        {children}

        <CameraRig pose={pose} snap={snap} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.08}
          minDistance={1.2}
          maxDistance={maxDistance}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
        />
      </Canvas>
      <div className="scene-tilt" aria-hidden="true" />
    </>
  );
};
