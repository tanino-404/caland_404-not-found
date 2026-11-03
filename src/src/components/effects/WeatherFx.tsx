import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  type AmbientLight,
  BoxGeometry,
  Color,
  type Group,
  type InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  Vector3,
} from 'three';
import type { WeatherCondition } from '../../types/weather';

/** 雲の置き方。month = 月の島の奥の空、year = 12 島の上空（高く・薄く） */
export type CloudLayout = 'month' | 'year';

export interface WeatherFxProps {
  condition: WeatherCondition;
  /** false なら何も描かない（タイトル画面や設定画面など） */
  visible: boolean;
  /** 雲の置き方。ワールドの切り替え（雲の遷移の下）で切り替わる */
  cloudLayout: CloudLayout;
}

const RAIN_COUNT = 400;
const SNOW_COUNT = 250;
const CLOUD_COUNT = 9;
const BLOCKS_PER_CLOUD = 8;
const CLOUD_INSTANCES = CLOUD_COUNT * BLOCKS_PER_CLOUD;

/** 粒子を降らせる範囲（グループ中心から x / z ±AREA、y 0〜TOP） */
const AREA = 14;
const TOP = 12;
/** 雨。1 秒あたりの落下と横風 */
const RAIN_SPEED = 14;
const RAIN_WIND = 1.6;
/** 雪。ゆっくり落ちて左右に揺れる */
const SNOW_SPEED_MIN = 0.6;
const SNOW_SPEED_RANGE = 0.6;
const SNOW_SWAY = 0.5;
/**
 * 雲。カメラには追従せず、空の決まった範囲に置いて x 方向へゆっくり流す（カメラを回しても雲は動かない）。
 * 位置は 0〜1 の正規化座標で持ち、置き方ごとに実際の範囲へ写す
 */
interface CloudBand {
  xFrom: number;
  xTo: number;
  zFrom: number;
  zTo: number;
}
interface CloudBox {
  /** 雲を置く帯。島の真上を避け、島の外側（左右・奥）の海の上空に置く */
  bands: readonly CloudBand[];
  yFrom: number;
  yTo: number;
  /** 雲 1 つの大きさの倍率 */
  scale: number;
  /** 不透明度の倍率（さりげなく） */
  opacity: number;
}
/*
 * 帯は「カメラの既定の姿勢から見て画面に入り、しかも島の上に重ならない」位置を計算で決めている。
 * - 年ビュー（カメラ (2, 40, 35) から (0, -2, 1) を見る、fov 40）：高さ 12〜14 で画面に入るのは x ±21 / z -10〜26。
 *   そのうち、地上へ投影して 12 島（x ±19 / z ±13）の外になる左右の縁と奥に置く（手前は月の数字と下部バーに重なるので置かない）
 * - 月ビュー（カメラ (3.6, 約 16, 約 12) から島の中心を見る）：塔の高さ（最大 5.5）あたりの、島（x ±3.5 / z ±3）の左右と奥
 */
const CLOUD_BOX: Record<CloudLayout, CloudBox> = {
  month: {
    bands: [
      { xFrom: -12, xTo: -6, zFrom: -8, zTo: 6 },
      { xFrom: 9, xTo: 14, zFrom: -8, zTo: 6 },
      { xFrom: -6, xTo: 10, zFrom: -10, zTo: -7 },
    ],
    yFrom: 5,
    yTo: 7,
    scale: 1,
    opacity: 0.6,
  },
  year: {
    bands: [
      { xFrom: -20, xTo: -13, zFrom: -8, zTo: 22 },
      { xFrom: 15, xTo: 21, zFrom: -8, zTo: 22 },
      { xFrom: -14, xTo: 16, zFrom: -10, zTo: -3 },
    ],
    yFrom: 12,
    yTo: 14,
    scale: 1.2,
    opacity: 0.42,
  },
};
/** 流れる速さ（正規化 x / 秒）。端まで行ったら反対側へ */
const CLOUD_DRIFT = 0.008;
/** 材質の opacity が目標へ寄る速さ（1/s）。約 1 秒で 98% */
const FADE_RATE = 4;
/** 粒子グループがカメラに追従する速さ（1/s） */
const FOLLOW_RATE = 3;
/** 雷。2〜6 秒ごとに 1 フレーム光って、以後フレームごとに減衰 */
const FLASH_MIN_SECONDS = 2;
const FLASH_RANGE_SECONDS = 4;
const FLASH_INTENSITY = 3.2;
const FLASH_DECAY = 0.45;
/** これより薄ければ描かない */
const INVISIBLE_OPACITY = 0.005;

const RAIN_GEOMETRY = new BoxGeometry(0.02, 0.5, 0.02);
const SNOW_GEOMETRY = new BoxGeometry(0.08, 0.08, 0.08);
const CLOUD_GEOMETRY = new BoxGeometry(1, 1, 1);

const RAIN_OPACITY = 0.55;
const SNOW_OPACITY = 0.95;
const CLOUD_OPACITY = 0.92;
const CLOUD_BRIGHT = new Color('#f3f6fa');
const CLOUD_DARK = new Color('#6f7986');

/** 材質はアプリで 1 組だけ持つ（WeatherFx は Canvas に 1 つ）。opacity は useFrame で動かす */
const materials = {
  rain: new MeshBasicMaterial({ color: '#bfe0ff', transparent: true, opacity: 0, depthWrite: false }),
  snow: new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
  cloud: new MeshLambertMaterial({ color: CLOUD_BRIGHT, transparent: true, opacity: 0 }),
};

/** 天気ごとの目標。opacity 0 はフェードアウト */
interface WeatherLook {
  rain: number;
  snow: number;
  cloud: number;
  cloudColor: Color;
  thunder: boolean;
}

const LOOK: Record<WeatherCondition, WeatherLook> = {
  clear: { rain: 0, snow: 0, cloud: 0, cloudColor: CLOUD_BRIGHT, thunder: false },
  cloudy: { rain: 0, snow: 0, cloud: CLOUD_OPACITY, cloudColor: CLOUD_BRIGHT, thunder: false },
  rain: { rain: RAIN_OPACITY, snow: 0, cloud: CLOUD_OPACITY, cloudColor: CLOUD_DARK, thunder: false },
  thunder: { rain: RAIN_OPACITY, snow: 0, cloud: CLOUD_OPACITY, cloudColor: CLOUD_DARK, thunder: true },
  snow: { rain: 0, snow: SNOW_OPACITY, cloud: CLOUD_OPACITY, cloudColor: CLOUD_BRIGHT, thunder: false },
};

/** 毎回同じ配置になる乱数（mulberry32） */
const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface Particles {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  speed: Float32Array;
  /** 雪の揺れの位相 */
  phase: Float32Array;
  /** 雪の揺れの周波数 */
  sway: Float32Array;
}

const buildParticles = (count: number, seed: number, speedMin: number, speedRange: number): Particles => {
  const random = seeded(seed);
  const particles: Particles = {
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    speed: new Float32Array(count),
    phase: new Float32Array(count),
    sway: new Float32Array(count),
  };
  for (let i = 0; i < count; i += 1) {
    particles.x[i] = (random() * 2 - 1) * AREA;
    particles.y[i] = random() * TOP;
    particles.z[i] = (random() * 2 - 1) * AREA;
    particles.speed[i] = speedMin + random() * speedRange;
    particles.phase[i] = random() * Math.PI * 2;
    particles.sway[i] = 0.8 + random() * 0.6;
  }
  return particles;
};

interface Clouds {
  /** 雲ごとの中心（x は流れる） */
  centerX: Float32Array;
  centerY: Float32Array;
  centerZ: Float32Array;
  /** ブロックごとの中心からのずれと大きさ */
  dx: Float32Array;
  dy: Float32Array;
  dz: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  sz: Float32Array;
}

/** 0.5 刻みに丸めてボクセルらしく角ばらせる */
const snapHalf = (value: number): number => Math.round(value * 2) / 2;

const buildClouds = (seed: number): Clouds => {
  const random = seeded(seed);
  const clouds: Clouds = {
    centerX: new Float32Array(CLOUD_COUNT),
    centerY: new Float32Array(CLOUD_COUNT),
    centerZ: new Float32Array(CLOUD_COUNT),
    dx: new Float32Array(CLOUD_INSTANCES),
    dy: new Float32Array(CLOUD_INSTANCES),
    dz: new Float32Array(CLOUD_INSTANCES),
    sx: new Float32Array(CLOUD_INSTANCES),
    sy: new Float32Array(CLOUD_INSTANCES),
    sz: new Float32Array(CLOUD_INSTANCES),
  };
  for (let c = 0; c < CLOUD_COUNT; c += 1) {
    // 正規化座標：x / y / z とも 0〜1。どの帯に置くかは雲の番号で決める
    clouds.centerX[c] = random();
    clouds.centerY[c] = random();
    clouds.centerZ[c] = random();
    for (let b = 0; b < BLOCKS_PER_CLOUD; b += 1) {
      const i = c * BLOCKS_PER_CLOUD + b;
      clouds.dx[i] = snapHalf((random() * 2 - 1) * 2.2);
      clouds.dz[i] = snapHalf((random() * 2 - 1) * 1.4);
      // 2 つに 1 つは少し上に積んで厚みを出す
      clouds.dy[i] = b % 2 === 0 ? 0 : 0.5;
      clouds.sx[i] = snapHalf(1.5 + random() * 1.5);
      clouds.sy[i] = b % 2 === 0 ? 0.8 : 0.5;
      clouds.sz[i] = snapHalf(1 + random() * 1.2);
    }
  }
  return clouds;
};

/** 粒子の位置。WeatherFx は Canvas に 1 つなので、材質と同じくモジュールで 1 組だけ持つ */
const rain = buildParticles(RAIN_COUNT, 11, RAIN_SPEED * 0.85, RAIN_SPEED * 0.3);
const snow = buildParticles(SNOW_COUNT, 23, SNOW_SPEED_MIN, SNOW_SPEED_RANGE);
const clouds = buildClouds(37);

/** 雨粒は風に合わせて少し傾ける。落下 (0, -RAIN_SPEED) と横風 (RAIN_WIND, 0) の合成方向 */
const rainDummy = new Object3D();
rainDummy.rotation.z = Math.atan2(RAIN_WIND, RAIN_SPEED);
const dummy = new Object3D();
const forward = new Vector3();

const wrap = (value: number, limit: number): number => {
  if (value > limit) return value - limit * 2;
  if (value < -limit) return value + limit * 2;
  return value;
};

/** 0〜TOP に収める（タブが止まって delta が大きくなっても下へ抜けない） */
const wrapHeight = (y: number): number => ((y % TOP) + TOP) % TOP;

/**
 * 現在の天気を 3D の中に描く。雨・雪・雲はそれぞれ 1 つの InstancedMesh で、位置は毎フレーム CPU で動かす。
 * 天気が変わったときは材質の opacity を約 1 秒でフェードさせる
 */
export const WeatherFx = ({ condition, visible, cloudLayout }: WeatherFxProps) => {
  const groupRef = useRef<Group>(null);
  const particleGroupRef = useRef<Group>(null);
  const cloudGroupRef = useRef<Group>(null);
  const rainRef = useRef<InstancedMesh>(null);
  const snowRef = useRef<InstancedMesh>(null);
  const cloudRef = useRef<InstancedMesh>(null);
  const flashRef = useRef<AmbientLight>(null);
  const nextFlashAt = useRef<number | null>(null);

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    const particleGroup = particleGroupRef.current;
    const cloudGroup = cloudGroupRef.current;
    const rainMesh = rainRef.current;
    const snowMesh = snowRef.current;
    const cloudMesh = cloudRef.current;
    const flash = flashRef.current;
    if (!group || !particleGroup || !cloudGroup || !rainMesh || !snowMesh || !cloudMesh || !flash) {
      return;
    }
    group.visible = visible;
    if (!visible) return;

    const look = LOOK[condition];
    const fade = 1 - Math.exp(-delta * FADE_RATE);
    const follow = 1 - Math.exp(-delta * FOLLOW_RATE);

    // 粒子の箱はカメラの少し前・少し下に追従する（年ビューの高いカメラでも目の前に降る）。
    // 月ビューでは下端が海面（y 0）に付く
    camera.getWorldDirection(forward);
    const horizontal = Math.hypot(forward.x, forward.z);
    const fx = horizontal > 0.01 ? forward.x / horizontal : 0;
    const fz = horizontal > 0.01 ? forward.z / horizontal : 0;
    particleGroup.position.x += (camera.position.x + fx * 6 - particleGroup.position.x) * follow;
    particleGroup.position.z += (camera.position.z + fz * 6 - particleGroup.position.z) * follow;
    particleGroup.position.y += (Math.min(0, camera.position.y - 11) - particleGroup.position.y) * follow;

    // 雲はワールドに固定（カメラの回転に付いてこない）
    const box = CLOUD_BOX[cloudLayout];

    materials.rain.opacity += (look.rain - materials.rain.opacity) * fade;
    materials.snow.opacity += (look.snow - materials.snow.opacity) * fade;
    materials.cloud.opacity += (look.cloud * box.opacity - materials.cloud.opacity) * fade;
    materials.cloud.color.lerp(look.cloudColor, fade);

    rainMesh.visible = materials.rain.opacity > INVISIBLE_OPACITY;
    snowMesh.visible = materials.snow.opacity > INVISIBLE_OPACITY;
    cloudMesh.visible = materials.cloud.opacity > INVISIBLE_OPACITY;

    if (rainMesh.visible) {
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        rain.y[i] = wrapHeight(rain.y[i] - rain.speed[i] * delta);
        rain.x[i] = wrap(rain.x[i] + RAIN_WIND * delta, AREA);
        rainDummy.position.set(rain.x[i], rain.y[i], rain.z[i]);
        rainDummy.updateMatrix();
        rainMesh.setMatrixAt(i, rainDummy.matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
    }

    if (snowMesh.visible) {
      const t = clock.elapsedTime;
      for (let i = 0; i < SNOW_COUNT; i += 1) {
        snow.y[i] = wrapHeight(snow.y[i] - snow.speed[i] * delta);
        snow.x[i] = wrap(snow.x[i] + Math.sin(t * snow.sway[i] + snow.phase[i]) * SNOW_SWAY * delta, AREA);
        dummy.position.set(snow.x[i], snow.y[i], snow.z[i]);
        dummy.updateMatrix();
        snowMesh.setMatrixAt(i, dummy.matrix);
      }
      snowMesh.instanceMatrix.needsUpdate = true;
    }

    if (cloudMesh.visible) {
      for (let c = 0; c < CLOUD_COUNT; c += 1) {
        // 帯の中を x 方向へゆっくり流れ、端まで行ったら反対側へ
        clouds.centerX[c] = (clouds.centerX[c] + CLOUD_DRIFT * delta) % 1;
        const band = box.bands[c % box.bands.length];
        const cx = band.xFrom + clouds.centerX[c] * (band.xTo - band.xFrom);
        const cy = box.yFrom + clouds.centerY[c] * (box.yTo - box.yFrom);
        const cz = band.zFrom + clouds.centerZ[c] * (band.zTo - band.zFrom);
        for (let b = 0; b < BLOCKS_PER_CLOUD; b += 1) {
          const i = c * BLOCKS_PER_CLOUD + b;
          dummy.position.set(
            cx + clouds.dx[i] * box.scale,
            cy + clouds.dy[i] * box.scale,
            cz + clouds.dz[i] * box.scale,
          );
          dummy.scale.set(clouds.sx[i] * box.scale, clouds.sy[i] * box.scale, clouds.sz[i] * box.scale);
          dummy.updateMatrix();
          cloudMesh.setMatrixAt(i, dummy.matrix);
        }
      }
      dummy.scale.set(1, 1, 1);
      cloudMesh.instanceMatrix.needsUpdate = true;
    }

    if (look.thunder) {
      const now = clock.elapsedTime;
      if (nextFlashAt.current === null) {
        nextFlashAt.current = now + FLASH_MIN_SECONDS + Math.random() * FLASH_RANGE_SECONDS;
      }
      if (now >= nextFlashAt.current) {
        flash.intensity = FLASH_INTENSITY;
        nextFlashAt.current = now + FLASH_MIN_SECONDS + Math.random() * FLASH_RANGE_SECONDS;
      } else if (flash.intensity > 0) {
        flash.intensity = flash.intensity > 0.05 ? flash.intensity * FLASH_DECAY : 0;
      }
    } else {
      flash.intensity = 0;
      nextFlashAt.current = null;
    }
  });

  return (
    <group ref={groupRef} visible={visible}>
      <group ref={particleGroupRef}>
        <instancedMesh ref={rainRef} args={[RAIN_GEOMETRY, materials.rain, RAIN_COUNT]} frustumCulled={false} />
        <instancedMesh ref={snowRef} args={[SNOW_GEOMETRY, materials.snow, SNOW_COUNT]} frustumCulled={false} />
      </group>
      <group ref={cloudGroupRef}>
        <instancedMesh
          ref={cloudRef}
          args={[CLOUD_GEOMETRY, materials.cloud, CLOUD_INSTANCES]}
          frustumCulled={false}
        />
      </group>
      <ambientLight ref={flashRef} intensity={0} color="#ffffff" />
    </group>
  );
};
