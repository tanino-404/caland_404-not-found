import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { type Group, MeshBasicMaterial } from 'three';
import { UNIT_BOX } from '../models/materials';
import { Voxel } from '../models/Voxel';

/** 島の飾りによく使う小物。プラグインの島は plugin-sdk から使う */

const GRASS = '#5fb63b';

const glowCache = new Map<string, MeshBasicMaterial>();
/** 灯りの入った窓や街灯。ライトの影響を受けず、いつも明るい */
const glowFor = (color: string): MeshBasicMaterial => {
  const cached = glowCache.get(color);
  if (cached !== undefined) return cached;
  const material = new MeshBasicMaterial({ color, toneMapped: false });
  glowCache.set(color, material);
  return material;
};

interface BoxProps {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
}

export const Glow = ({ x, y, z, w, h, d, color }: BoxProps) => (
  <mesh geometry={UNIT_BOX} material={glowFor(color)} position={[x, y + h / 2, z]} scale={[w, h, d]} />
);

type Vec3 = [number, number, number];

/** ボクセルの広葉樹 */
export const OakTree = ({ position, scale = 1 }: { position: Vec3; scale?: number }) => (
  <group position={position} scale={scale}>
    <Voxel x={0} y={0} z={0} w={0.09} h={0.36} d={0.09} color="#7a4e24" />
    <Voxel x={0} y={0.3} z={0} w={0.5} h={0.34} d={0.5} color="#3e8a2a" />
    <Voxel x={0.04} y={0.6} z={0.02} w={0.36} h={0.2} d={0.36} color="#4caf3a" />
    <Voxel x={-0.2} y={0.42} z={0.12} w={0.18} h={0.16} d={0.18} color="#5fb63b" />
    <Voxel x={0.2} y={0.38} z={-0.14} w={0.16} h={0.16} d={0.16} color="#5fb63b" />
  </group>
);

export const LampPost = ({ position }: { position: Vec3 }) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.05} h={0.5} d={0.05} color="#2b2f36" />
    <Voxel x={0} y={0.5} z={0} w={0.12} h={0.03} d={0.12} color="#2b2f36" />
    <Glow x={0} y={0.53} z={0} w={0.09} h={0.1} d={0.09} color="#ffe7a0" />
    <Voxel x={0} y={0.63} z={0} w={0.12} h={0.03} d={0.12} color="#2b2f36" />
  </group>
);

/** 苔むした崖と、海へ落ちる滝。しぶきが流れ落ちる */
export const WaterfallCliff = ({ position }: { position: Vec3 }) => {
  const drops = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = drops.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const k = (clock.elapsedTime * 0.6 + i / g.children.length) % 1;
      child.position.y = 1.7 - k * 1.7;
    });
  });
  return (
    <group position={position}>
      <Voxel x={0} y={-0.2} z={0} w={1.5} h={2.1} d={1.2} color="#8f949b" />
      <Voxel x={0.25} y={-0.2} z={0.05} w={1.2} h={1.3} d={1.26} color="#7e838b" />
      <Voxel x={0} y={1.9} z={0} w={1.54} h={0.1} d={1.24} color={GRASS} />
      <Voxel x={-0.62} y={1.2} z={0.62} w={0.1} h={0.7} d={0.04} color="#3e8a2a" />
      <Voxel x={0.6} y={1.35} z={0.62} w={0.1} h={0.55} d={0.04} color="#3e8a2a" />
      <Glow x={0.05} y={0} z={0.62} w={0.62} h={1.92} d={0.05} color="#9fe3ff" />
      <Glow x={-0.12} y={0} z={0.65} w={0.08} h={1.92} d={0.02} color="#d8f6ff" />
      <Glow x={0.2} y={0} z={0.65} w={0.06} h={1.92} d={0.02} color="#d8f6ff" />
      <group ref={drops}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Glow key={i} x={(i % 4) * 0.15 - 0.17} y={0} z={0.68} w={0.07} h={0.2} d={0.02} color="#ffffff" />
        ))}
      </group>
      <Glow x={0.05} y={0} z={0.75} w={1.0} h={0.1} d={0.45} color="#ffffff" />
      <Glow x={0.05} y={0} z={0.95} w={0.6} h={0.06} d={0.25} color="#e8fbff" />
      <OakTree position={[0.2, 2.0, -0.15]} scale={1.3} />
      <OakTree position={[-0.45, 2.0, 0.2]} scale={0.9} />
    </group>
  );
};
