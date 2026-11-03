/**
 * 達成エフェクト「降り注ぐオブジェクト」の汎用版。
 * 何を降らせるかは呼び出し側が `RainObjectSpec[]` で渡す（家計簿なら金貨と札。別の管理機能なら星やメダルなど）。
 *
 * 使い方の例：
 * ```tsx
 * const STAR = new OctahedronGeometry(0.3);
 * const STAR_MAT = new MeshStandardMaterial({ color: '#ffd24a' });
 * const objects = useMemo<RainObjectSpec[]>(() => [{
 *   geometry: STAR,
 *   material: STAR_MAT,
 *   count: 24,
 *   scale: { min: 0.8, max: 1.3 },
 *   spin: { min: 0.6, max: 2.2 },
 *   fall: { min: 1.2, max: 2.2 },
 * }], []);
 * <CelebrationRain objects={objects} active={achieved} />
 * ```
 * - `objects` は毎レンダー作り直さず、`useMemo` やモジュール定数で固定する（変わるたびに材質を複製し直すため）。
 * - 複数パーツの物体（金貨の胴＋縁＋面）は geometry をグループ付きで結合し、`material` に配列を渡す。
 * - 渡した材質は複製してから `transparent / opacity` を触るので、呼び出し側の材質は汚れない。
 *
 * 演出：
 * - 全体：`active` の切り替えで 1 秒かけてフェードイン・アウトする（達成した月に入った / 出た）
 * - 1 個ずつ：上端の帯でふわっと現れ（不透明度と大きさが 0 → 1）、下端の帯で消えていく。
 *   出現の高さ・位置・向き・大きさ・落下速度・横の漂い（x / z の速度）・揺れは毎回ランダムに引き直す
 * - 個体ごとの不透明度は InstancedBufferAttribute `instanceAlpha` で渡し、複製した材質のシェーダーで掛ける
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  MeshBasicMaterial,
  Object3D,
} from 'three';

export interface RainObjectSpec {
  /** 1 個ぶんの形と材質（InstancedMesh にする） */
  geometry: BufferGeometry;
  material: Material | Material[];
  count: number;
  /** 大きさのばらつき（例 { min: 0.8, max: 1.3 }） */
  scale: { min: number; max: number };
  /** 回転の速さ（rad/s）のばらつき */
  spin: { min: number; max: number };
  /** 落下速度（単位/s）のばらつき */
  fall: { min: number; max: number };
}

export interface RainArea {
  halfX: number;
  halfZ: number;
  top: number;
  bottom: number;
}

export interface CelebrationRainProps {
  objects: RainObjectSpec[];
  /** false にするとフェードアウトし、終わったら何も描かない。true に戻すとフェードイン */
  active: boolean;
  /** 降る範囲。中心は親の group の原点。既定は x ±5.5 / z ±4.5 / top 9 / bottom 0.4 */
  area?: RainArea;
  /** キラキラ（小さな十字）を出すか。既定 true */
  sparkles?: boolean;
}

const DEFAULT_AREA: RainArea = { halfX: 5.5, halfZ: 4.5, top: 9, bottom: 0.4 };
/** 全体のフェードイン・アウトにかける秒数 */
const FADE_SECONDS = 1.0;
/** 1 個ずつ：上端から現れきるまでの帯の高さ、下端で消えはじめる帯の高さ（範囲の高さに対する割合） */
const APPEAR_BAND = 0.22;
const VANISH_BAND = 0.28;
/** 上端より上にばらけて出現させる高さ（範囲の高さに対する割合）。同時に湧かず、ぽつぽつ現れる */
const SPAWN_SPREAD = 0.35;
/** 横の漂い（単位/s）の最大値 */
const DRIFT_MAX = 0.45;
const SPARK_COUNT = 28;
const SPARK_OPACITY = 0.95;

/** 縦棒と横棒を1枚の十字にする。インスタンスのスケールで点滅させる。 */
const SPARK_CROSS = new BufferGeometry();
SPARK_CROSS.setAttribute(
  'position',
  new Float32BufferAttribute(
    [
      -0.07, -0.5, 0, 0.07, -0.5, 0, 0.07, 0.5, 0,
      -0.07, -0.5, 0, 0.07, 0.5, 0, -0.07, 0.5, 0,
      -0.5, -0.07, 0, 0.5, -0.07, 0, 0.5, 0.07, 0,
      -0.5, -0.07, 0, 0.5, 0.07, 0, -0.5, 0.07, 0,
    ],
    3,
  ),
);
const SPARK_WHITE = new Color('#fff6c8');
const SPARK_GOLD = new Color('#ffe27a');
const sparkTint = new Color();

const dummy = new Object3D();

const randomBetween = (range: { min: number; max: number }): number =>
  range.min + Math.random() * (range.max - range.min);

/** 1 種類ぶんの個体の状態。毎フレームの割り当てを避けるため Float32Array にまとめて持つ */
interface RainState {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  scale: Float32Array;
  fall: Float32Array;
  /** 3 軸の回転角 */
  rotX: Float32Array;
  rotY: Float32Array;
  rotZ: Float32Array;
  /** 3 軸の回転速度（rad/s） */
  spinX: Float32Array;
  spinY: Float32Array;
  spinZ: Float32Array;
  /** 横揺れの振幅・周波数・位相（x と z で別） */
  swayAmpX: Float32Array;
  swayFreqX: Float32Array;
  swayPhaseX: Float32Array;
  swayAmpZ: Float32Array;
  swayFreqZ: Float32Array;
  swayPhaseZ: Float32Array;
  /** 横方向にゆっくり流れる速度（x / z、単位/s） */
  driftX: Float32Array;
  driftZ: Float32Array;
}

const respawn = (state: RainState, i: number, spec: RainObjectSpec, area: RainArea, y: number) => {
  state.x[i] = (Math.random() * 2 - 1) * area.halfX;
  state.z[i] = (Math.random() * 2 - 1) * area.halfZ;
  state.y[i] = y;
  state.scale[i] = randomBetween(spec.scale);
  state.fall[i] = randomBetween(spec.fall);
  state.rotX[i] = Math.random() * Math.PI * 2;
  state.rotY[i] = Math.random() * Math.PI * 2;
  state.rotZ[i] = Math.random() * Math.PI * 2;
  // 主に 1 軸で回り、他の軸は弱く。符号もランダム
  const main = randomBetween(spec.spin);
  const axis = Math.floor(Math.random() * 3);
  const sign = Math.random() < 0.5 ? -1 : 1;
  state.spinX[i] = (axis === 0 ? main : main * 0.25) * sign;
  state.spinY[i] = (axis === 1 ? main : main * 0.25) * (Math.random() < 0.5 ? -1 : 1);
  state.spinZ[i] = (axis === 2 ? main : main * 0.25) * sign;
  state.swayAmpX[i] = 0.15 + Math.random() * 0.4;
  state.swayFreqX[i] = 0.6 + Math.random() * 1.2;
  state.swayPhaseX[i] = Math.random() * Math.PI * 2;
  state.swayAmpZ[i] = 0.1 + Math.random() * 0.3;
  state.swayFreqZ[i] = 0.5 + Math.random() * 1.0;
  state.swayPhaseZ[i] = Math.random() * Math.PI * 2;
  state.driftX[i] = (Math.random() * 2 - 1) * DRIFT_MAX;
  state.driftZ[i] = (Math.random() * 2 - 1) * DRIFT_MAX;
};

const createState = (spec: RainObjectSpec, area: RainArea): RainState => {
  const n = spec.count;
  const state: RainState = {
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    scale: new Float32Array(n),
    fall: new Float32Array(n),
    rotX: new Float32Array(n),
    rotY: new Float32Array(n),
    rotZ: new Float32Array(n),
    spinX: new Float32Array(n),
    spinY: new Float32Array(n),
    spinZ: new Float32Array(n),
    swayAmpX: new Float32Array(n),
    swayFreqX: new Float32Array(n),
    swayPhaseX: new Float32Array(n),
    swayAmpZ: new Float32Array(n),
    swayFreqZ: new Float32Array(n),
    swayPhaseZ: new Float32Array(n),
    driftX: new Float32Array(n),
    driftZ: new Float32Array(n),
  };
  for (let i = 0; i < n; i += 1) {
    // 初期の高さは範囲内に均等にばらけさせ、最初の数秒で一斉に落ちてこないようにする
    const y = area.bottom + ((i + Math.random()) / n) * (area.top - area.bottom);
    respawn(state, i, spec, area, y);
  }
  return state;
};

/** 個体ごとの不透明度を掛けるシェーダーの差し込み（color_fragment は map の後なので、テクスチャ付きの面にも効く） */
const injectInstanceAlpha = (material: Material) => {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceAlpha;\nvarying float vRainAlpha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRainAlpha = instanceAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRainAlpha;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vRainAlpha;');
  };
  material.customProgramCacheKey = () => 'celebration-rain-instance-alpha';
};

/** 呼び出し側の材質を汚さないよう複製し、全体フェード用に透明化して、個体ごとの不透明度を差し込む */
const cloneForFade = (material: Material | Material[]): Material[] =>
  (Array.isArray(material) ? material : [material]).map((m) => {
    const copy = m.clone();
    copy.transparent = true;
    copy.opacity = 0;
    injectInstanceAlpha(copy);
    return copy;
  });

/** 呼び出し側の geometry を汚さないよう複製し、個体ごとの不透明度の属性を付ける */
const cloneWithAlpha = (geometry: BufferGeometry, count: number): { geometry: BufferGeometry; alpha: InstancedBufferAttribute } => {
  const copy = geometry.clone();
  const alpha = new InstancedBufferAttribute(new Float32Array(count), 1);
  alpha.setUsage(DynamicDrawUsage);
  copy.setAttribute('instanceAlpha', alpha);
  return { geometry: copy, alpha };
};

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const u = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return u * u * (3 - 2 * u);
};

interface RainLayer {
  spec: RainObjectSpec;
  geometry: BufferGeometry;
  alpha: InstancedBufferAttribute;
  materials: Material[];
  state: RainState;
}

export const CelebrationRain = ({ objects, active, area = DEFAULT_AREA, sparkles = true }: CelebrationRainProps) => {
  const groupRef = useRef<Object3D>(null);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const sparkRef = useRef<InstancedMesh>(null);
  /** 全体の不透明度 0〜1。マウント時は 0 から立ち上げる */
  const fade = useRef(0);

  const layers = useMemo<RainLayer[]>(
    () =>
      objects.map((spec) => ({
        spec,
        ...cloneWithAlpha(spec.geometry, spec.count),
        materials: cloneForFade(spec.material),
        state: createState(spec, area),
      })),
    [objects, area],
  );
  const sparkMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ffffff',
        side: DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      layers.forEach((layer) => {
        layer.materials.forEach((m) => m.dispose());
        layer.geometry.dispose();
      });
    },
    [layers],
  );
  useEffect(() => () => sparkMaterial.dispose(), [sparkMaterial]);

  useFrame(({ clock, camera }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const target = active ? 1 : 0;
    const step = Math.min(delta, 0.1) / FADE_SECONDS;
    if (fade.current < target) fade.current = Math.min(target, fade.current + step);
    else if (fade.current > target) fade.current = Math.max(target, fade.current - step);
    const opacity = fade.current;

    if (opacity <= 0) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.1);
    // 全体に共通の風。速度がゆっくり変わる（積分すると有界なので範囲の外へ流れ続けない）
    const windX = 0.45 * Math.sin(t * 0.21) + 0.2 * Math.sin(t * 0.53 + 1.1);
    const windZ = 0.35 * Math.sin(t * 0.17 + 2.3) + 0.15 * Math.sin(t * 0.41);

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const mesh = meshRefs.current[layerIndex];
      if (!mesh) continue;
      const { spec, materials, state, alpha } = layers[layerIndex];
      for (let m = 0; m < materials.length; m += 1) {
        materials[m].opacity = opacity;
      }
      const height = area.top - area.bottom;
      const appearFrom = area.top;
      const appearTo = area.top - height * APPEAR_BAND;
      const vanishTo = area.bottom + height * VANISH_BAND;
      const alphas = alpha.array as Float32Array;
      for (let i = 0; i < spec.count; i += 1) {
        state.y[i] -= state.fall[i] * dt;
        if (state.y[i] < area.bottom) {
          respawn(state, i, spec, area, area.top + Math.random() * height * SPAWN_SPREAD);
        }
        state.x[i] += state.driftX[i] * dt;
        state.z[i] += state.driftZ[i] * dt;
        // 範囲の外へ流れたら反対側へ（どうせ半透明の帯の外なので目立たない）
        if (state.x[i] > area.halfX) state.x[i] -= area.halfX * 2;
        else if (state.x[i] < -area.halfX) state.x[i] += area.halfX * 2;
        if (state.z[i] > area.halfZ) state.z[i] -= area.halfZ * 2;
        else if (state.z[i] < -area.halfZ) state.z[i] += area.halfZ * 2;
        // 上端の帯で現れ、下端の帯で消える。上端より上（出現待ち）は 0
        const life = (1 - smoothstep(appearTo, appearFrom, state.y[i])) * smoothstep(area.bottom, vanishTo, state.y[i]);
        alphas[i] = life;
        state.rotX[i] += state.spinX[i] * dt;
        state.rotY[i] += state.spinY[i] * dt;
        state.rotZ[i] += state.spinZ[i] * dt;
        const swayX = Math.sin(t * state.swayFreqX[i] + state.swayPhaseX[i]) * state.swayAmpX[i];
        const swayZ = Math.sin(t * state.swayFreqZ[i] + state.swayPhaseZ[i]) * state.swayAmpZ[i];
        dummy.position.set(state.x[i] + swayX + windX, state.y[i], state.z[i] + swayZ + windZ);
        dummy.rotation.set(state.rotX[i], state.rotY[i], state.rotZ[i]);
        // 現れるときは小さく、消えるときも少し縮む
        dummy.scale.setScalar(state.scale[i] * (0.45 + 0.55 * life));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      alpha.needsUpdate = true;
    }

    const sparkMesh = sparkRef.current;
    if (sparkMesh) {
      sparkMaterial.opacity = SPARK_OPACITY * opacity;
      if (sparkMesh.instanceColor === null) {
        for (let i = 0; i < SPARK_COUNT; i += 1) {
          sparkTint.copy(SPARK_GOLD).lerp(SPARK_WHITE, (i % 7) / 6);
          sparkMesh.setColorAt(i, sparkTint);
        }
      }
      const sx = area.halfX / DEFAULT_AREA.halfX;
      const sz = area.halfZ / DEFAULT_AREA.halfZ;
      const yLow = area.bottom + (area.top - area.bottom) * 0.17;
      const yRange = (area.top - area.bottom) * 0.57;
      for (let i = 0; i < SPARK_COUNT; i += 1) {
        const angle = (i / SPARK_COUNT) * Math.PI * 2 + (i % 3) * 0.41;
        const x = Math.cos(angle) * (2.1 + (i % 5) * 0.92) * sx;
        const z = Math.sin(angle) * (1.4 + (i % 4) * 1.05) * sz;
        const yBase = yLow + (((i * 11) % SPARK_COUNT) / (SPARK_COUNT - 1)) * yRange;
        const y = yBase + Math.sin(t * 0.42 + i * 0.8) * 0.2;
        const twinkle = 0.5 + 0.5 * Math.sin(t * (0.7 + (i % 5) * 0.12) + i * 1.7);
        const size = (0.22 + (i % 5) * 0.045) * (0.18 + twinkle * 0.82);
        dummy.position.set(x, y, z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(i * 0.55 + t * 0.12);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, dummy.matrix);
      }
      sparkMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {layers.map((layer, index) => (
        <instancedMesh
          // 材質を複製し直したら InstancedMesh も作り直す
          key={`${index}-${layer.materials[0].uuid}`}
          ref={(mesh) => {
            meshRefs.current[index] = mesh;
          }}
          args={[layer.geometry, layer.materials.length === 1 ? layer.materials[0] : layer.materials, layer.spec.count]}
          frustumCulled={false}
        />
      ))}
      {sparkles ? (
        <instancedMesh ref={sparkRef} args={[SPARK_CROSS, sparkMaterial, SPARK_COUNT]} frustumCulled={false} />
      ) : null}
    </group>
  );
};
