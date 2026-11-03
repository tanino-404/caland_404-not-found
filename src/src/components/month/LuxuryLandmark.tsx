import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { type Group, MeshStandardMaterial } from 'three';
import { pixelArtGeometry } from '../models/pixelArt';

/** 7×10 の $。o は濃い金の縁、g は金、h は照り */
const DOLLAR_ROWS = [
  '...h...',
  '.hgggo.',
  'gg.g.oo',
  'gg.g...',
  '.gggo..',
  '...ggo.',
  '...g.oo',
  'gg.g.oo',
  '.ggggo.',
  '...o...',
];

const DOLLAR_GEOMETRY = pixelArtGeometry(DOLLAR_ROWS, { g: '#ffd23a', h: '#fff3a8', o: '#d98c00' }, 1.4);
const DOLLAR_MAT = new MeshStandardMaterial({
  vertexColors: true,
  metalness: 0.4,
  roughness: 0.3,
  emissive: '#ffb000',
  emissiveIntensity: 0.55,
});
/** 1 ピクセルの大きさ。$ 全体で高さ約 1.2 */
const PIXEL = 0.12;

export interface LuxuryLandmarkProps {
  /** いちばん高い塔の中心 */
  x: number;
  z: number;
  /** 塔の天面の高さ */
  top: number;
}

/**
 * いちばん高い塔の上に浮かび、カメラを向いてゆれる巨大な金の $。
 * 屋上の町を覆わないよう、建物より上に浮かせる。日ビューでは出さない（MonthScene）。
 */
export const LuxuryLandmark = ({ x, z, top }: LuxuryLandmarkProps) => {
  const group = useRef<Group>(null);
  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    // 常にカメラへ向け、左右に小さく振って立体感を見せる（真横を向いて読めなくならない）
    g.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z) + Math.sin(t * 0.9) * 0.45;
    g.position.y = top + 1.35 + Math.sin(t * 1.2) * 0.08;
  });
  return (
    <group ref={group} position={[x, top + 1.35, z]}>
      <mesh geometry={DOLLAR_GEOMETRY} material={DOLLAR_MAT} scale={PIXEL} />
    </group>
  );
};
