import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, Color, DynamicDrawUsage, PlaneGeometry } from 'three';
import { SEA_Y } from '../../lib/camera';
import type { IslandTheme } from '../../types/ledger';
import { BLOCK_COLORS } from '../models/blocks/blockKinds';

/** 波立つ海面の一辺。年ビューの 12 島（横 37 × 奥 24）と俯瞰カメラの視界まで覆う */
const WAVE_SIZE = 110;
/** 分割数。150×150（約 2.3 万頂点）でも CPU で毎フレーム高さと色を更新できる */
const WAVE_SEGMENTS = 150;
/** 波の面の端に向かって波を静め、遠景の平らな板と継ぎ目なくつなぐ（中心からの距離。正方形の端までは 55） */
const EDGE_CALM_FROM = 40;
const EDGE_CALM_TO = 53;
/** 遠景の平らな板。タイトル画面の低いカメラや年ビューの隣年スライドでも端が見えない広さ */
const FAR_SIZE = 400;
/** 島の近く（原点からこの半径まで）は振幅を抑え、予定 0 の日の水ブロック（高さ 0.12）を突き抜けない */
const CALM_RADIUS = 5;
/** この半径で振幅が最大倍率に達する */
const ROUGH_RADIUS = 12;
/** 外側の振幅倍率 */
const ROUGH_GAIN = 3;
/** 島の近くでの振幅の合計（±） */
const BASE_AMPLITUDE = 0.1;
/** 波の山の泡っぽい色 */
const FOAM_COLOR = '#9fe0ff';

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const u = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return u * u * (3 - 2 * u);
};

/**
 * 島の周りの海。内側は頂点を毎フレーム動かすサイン波、外側は平らな遠景板。
 * 島の近くは振幅 ±0.1、外へ向かって振幅を上げる。頂点カラーで山を明るく、谷を濃くして波間を見せる。
 */
export interface SeaProps {
  theme: IslandTheme;
}

interface WaveBuffers {
  geometry: PlaneGeometry;
  /** 回転前の x / y（毎フレームここから高さを作り直す） */
  baseX: Float32Array;
  baseY: Float32Array;
  /** 頂点ごとの振幅倍率（距離で決まるので 1 回だけ計算） */
  gain: Float32Array;
}

const createWave = (): WaveBuffers => {
  const geometry = new PlaneGeometry(WAVE_SIZE, WAVE_SIZE, WAVE_SEGMENTS, WAVE_SEGMENTS);
  const position = geometry.attributes.position as BufferAttribute;
  position.setUsage(DynamicDrawUsage);
  const count = position.count;
  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);
  const gain = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    baseX[i] = x;
    baseY[i] = y;
    const rough = 1 + (ROUGH_GAIN - 1) * smoothstep(CALM_RADIUS, ROUGH_RADIUS, Math.hypot(x, y));
    const edge = 1 - smoothstep(EDGE_CALM_FROM, EDGE_CALM_TO, Math.max(Math.abs(x), Math.abs(y)));
    gain[i] = rough * edge;
  }
  const color = new BufferAttribute(new Float32Array(count * 3), 3);
  color.setUsage(DynamicDrawUsage);
  geometry.setAttribute('color', color);
  return { geometry, baseX, baseY, gain };
};

export const Sea = ({ theme }: SeaProps) => {
  const wave = useMemo(() => createWave(), []);
  useEffect(() => () => wave.geometry.dispose(), [wave]);

  const isLuxury = theme === 'luxury';
  const seaColor = isLuxury ? BLOCK_COLORS.luxurySea : BLOCK_COLORS.sea;
  const palette = useMemo(() => {
    const base = new Color(seaColor);
    return {
      base,
      crest: new Color(FOAM_COLOR),
      trough: base.clone().multiplyScalar(0.84),
      scratch: new Color(),
    };
  }, [seaColor]);

  useFrame(({ clock }) => {
    const { geometry, baseX, baseY, gain } = wave;
    const position = geometry.attributes.position as BufferAttribute;
    const color = geometry.attributes.color as BufferAttribute;
    const heights = position.array as Float32Array;
    const colors = color.array as Float32Array;
    const { base, crest, trough, scratch } = palette;

    const t = clock.elapsedTime;
    for (let i = 0; i < baseX.length; i += 1) {
      const px = baseX[i];
      // 回転前の y は、-PI/2 回転後のワールド z に対応する
      const pz = -baseY[i];
      const g = gain[i];
      // 振幅の合計は ±BASE_AMPLITUDE × g
      const h =
        g *
        (0.05 * Math.sin(px * 0.9 + t * 1.4) +
          0.03 * Math.sin(pz * 1.3 - t * 1.1) +
          0.02 * Math.sin((px + pz) * 0.6 + t * 0.8));
      heights[i * 3 + 2] = h;
      // -1〜1 に正規化した高さで、山は泡色へ、谷は濃い色へ。端（g = 0）は遠景と同じ基色
      const n = g > 0.001 ? (h / (BASE_AMPLITUDE * g)) * Math.min(1, g) : 0;
      if (n >= 0) {
        // 山は泡色へ寄せるが、白くなりすぎないよう最大 45% にとどめる
        scratch.copy(base).lerp(crest, n * n * 0.45);
      } else {
        scratch.copy(base).lerp(trough, -n);
      }
      colors[i * 3] = scratch.r;
      colors[i * 3 + 1] = scratch.g;
      colors[i * 3 + 2] = scratch.b;
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    // flatShading のため法線は面の微分から求まる。頂点法線の再計算は不要
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y - 0.01, 0]}>
        <planeGeometry args={[FAR_SIZE, FAR_SIZE]} />
        <meshStandardMaterial
          color={seaColor}
          roughness={isLuxury ? 0.5 : 0.7}
          metalness={isLuxury ? 0.1 : 0}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 0]} geometry={wave.geometry}>
        <meshStandardMaterial
          color="#ffffff"
          vertexColors
          roughness={isLuxury ? 0.5 : 0.7}
          metalness={isLuxury ? 0.1 : 0}
          flatShading
        />
      </mesh>
    </group>
  );
};
