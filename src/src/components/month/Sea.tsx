import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { BufferAttribute, PlaneGeometry } from 'three';
import { SEA_Y } from '../../lib/camera';
import type { IslandTheme } from '../../types/ledger';
import { BLOCK_COLORS } from '../models/blocks/blockKinds';

/** 波立つ海面の一辺（島を囲む範囲） */
const WAVE_SIZE = 24;
/** 分割数。64×64 なら CPU で毎フレーム更新しても軽い */
const WAVE_SEGMENTS = 64;
/** 遠景の平らな板 */
const FAR_SIZE = 160;

/**
 * 島の周りの海。内側は頂点を毎フレーム動かすサイン波、外側は平らな遠景板。
 * 振幅の合計は ±0.1 に収め、予定 0 の日の水ブロック（高さ 0.12）を突き抜けないようにする。
 */
export interface SeaProps {
  theme: IslandTheme;
}

export const Sea = ({ theme }: SeaProps) => {
  const geometryRef = useRef<PlaneGeometry>(null);
  // 初期 x / y（回転前）を保持して、毎フレームここから高さを作り直す
  const base = useRef<{ x: Float32Array; y: Float32Array } | null>(null);

  const color = theme === 'luxury' ? BLOCK_COLORS.luxurySea : BLOCK_COLORS.sea;

  useFrame(({ clock }) => {
    const geometry = geometryRef.current;
    if (!geometry) return;

    const position = geometry.attributes.position as BufferAttribute;
    const array = position.array as Float32Array;

    if (!base.current) {
      const count = position.count;
      const x = new Float32Array(count);
      const y = new Float32Array(count);
      for (let i = 0; i < count; i += 1) {
        x[i] = array[i * 3];
        y[i] = array[i * 3 + 1];
      }
      base.current = { x, y };
    }

    const t = clock.elapsedTime;
    const { x: bx, y: by } = base.current;
    for (let i = 0; i < bx.length; i += 1) {
      const px = bx[i];
      // 回転前の y は、-PI/2 回転後のワールド z に対応する
      const pz = -by[i];
      array[i * 3 + 2] =
        0.05 * Math.sin(px * 0.9 + t * 1.4) +
        0.03 * Math.sin(pz * 1.3 - t * 1.1) +
        0.02 * Math.sin((px + pz) * 0.6 + t * 0.8);
    }
    position.needsUpdate = true;
    // flatShading のため法線は面の微分から求まる。頂点法線の再計算は不要
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y - 0.01, 0]}>
        <planeGeometry args={[FAR_SIZE, FAR_SIZE]} />
        <meshStandardMaterial
          color={color}
          roughness={theme === 'luxury' ? 0.28 : 0.7}
          metalness={theme === 'luxury' ? 0.22 : 0}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 0]}>
        <planeGeometry ref={geometryRef} args={[WAVE_SIZE, WAVE_SIZE, WAVE_SEGMENTS, WAVE_SEGMENTS]} />
        <meshStandardMaterial
          color={color}
          roughness={theme === 'luxury' ? 0.28 : 0.7}
          metalness={theme === 'luxury' ? 0.22 : 0}
          flatShading
        />
      </mesh>
    </group>
  );
};
