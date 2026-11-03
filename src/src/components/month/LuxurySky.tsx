import { useFrame } from '@react-three/fiber';
import { type ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import { type Group, type InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { UNIT_BOX } from '../models/materials';
import { GoldVoxel } from '../models/luxury/GoldVoxel';
import { Palm } from '../models/luxury/Palm';
import { Voxel } from '../models/Voxel';

/** 0〜1 の決まった乱数（毎回同じ雲の形にする） */
const rand = (i: number, salt: number): number => {
  const v = Math.sin(i * 91.17 + salt * 47.31) * 43758.5453;
  return v - Math.floor(v);
};

interface CloudBox {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  shade: boolean;
}

/** 雲 1 つ = 平たい土台＋上に積んだ立方体。下面だけ少し青い */
const buildCloud = (cx: number, cy: number, cz: number, size: number, seed: number): CloudBox[] => {
  const boxes: CloudBox[] = [
    { x: cx, y: cy, z: cz, w: 2.6 * size, h: 0.45 * size, d: 1.5 * size, shade: true },
    { x: cx, y: cy + 0.4 * size, z: cz, w: 2.3 * size, h: 0.5 * size, d: 1.3 * size, shade: false },
  ];
  const puffs = 3 + Math.floor(rand(seed, 1) * 4);
  for (let p = 0; p < puffs; p++) {
    const s = (0.55 + rand(seed + p, 2) * 0.55) * size;
    boxes.push({
      x: cx + (rand(seed + p, 3) - 0.5) * 1.8 * size,
      y: cy + 0.55 * size + rand(seed + p, 4) * 0.35 * size,
      z: cz + (rand(seed + p, 5) - 0.5) * 0.8 * size,
      w: s,
      h: s,
      d: s * 0.9,
      shade: false,
    });
  }
  return boxes;
};

/** 礁湖のまわりの低い雲（雲海）と、奥の空の雲 */
const CLOUDS: CloudBox[] = (() => {
  const boxes: CloudBox[] = [];
  const low = 22;
  for (let i = 0; i < low; i++) {
    const angle = (i / low) * Math.PI * 2 + rand(i, 6) * 0.25;
    const r = 10.5 + rand(i, 7) * 3.5;
    boxes.push(...buildCloud(Math.cos(angle) * r * 1.15, -1.1 + rand(i, 8) * 0.9, Math.sin(angle) * r, 0.9 + rand(i, 9) * 0.7, i * 13));
  }
  const high: [number, number, number, number][] = [
    [-8.5, 4.2, -7, 1.4],
    [7.5, 5.2, -9, 1.6],
    [-3, 6.5, -13, 1.8],
    [4, 3.4, -12, 1.2],
    [-11, 2.2, 1, 1.3],
    [11.5, 2.8, 2, 1.4],
  ];
  high.forEach(([x, y, z, s], i) => boxes.push(...buildCloud(x, y, z, s, 500 + i * 17)));
  return boxes;
})();

const CLOUD_WHITE = new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 });
const CLOUD_SHADE = new MeshStandardMaterial({ color: '#d4e8ff', emissive: '#b8d8ff', emissiveIntensity: 0.2, roughness: 1 });

/** 礁湖の外の雲海と奥の空の雲（マッチョの島でも使う） */
export const Clouds = () => {
  const white = useRef<InstancedMesh>(null);
  const shade = useRef<InstancedMesh>(null);
  const group = useRef<Group>(null);
  const counts = useMemo(
    () => ({ white: CLOUDS.filter((b) => !b.shade).length, shade: CLOUDS.filter((b) => b.shade).length }),
    [],
  );

  useLayoutEffect(() => {
    const whiteMesh = white.current;
    const shadeMesh = shade.current;
    if (!whiteMesh || !shadeMesh) {
      throw new Error('LuxurySky: 雲のメッシュがありません');
    }
    const o = new Object3D();
    let wi = 0;
    let si = 0;
    for (const b of CLOUDS) {
      o.position.set(b.x, b.y + b.h / 2, b.z);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      if (b.shade) shadeMesh.setMatrixAt(si++, o.matrix);
      else whiteMesh.setMatrixAt(wi++, o.matrix);
    }
    whiteMesh.instanceMatrix.needsUpdate = true;
    shadeMesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.006;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={white} args={[UNIT_BOX, CLOUD_WHITE, counts.white]} />
      <instancedMesh ref={shade} args={[UNIT_BOX, CLOUD_SHADE, counts.shade]} />
    </group>
  );
};

interface FloatingIslandProps {
  position: [number, number, number];
  scale: number;
  phase: number;
  /** 天面に載せるもの（天面の高さ 0.18 が原点） */
  children: ReactNode;
}

/** 空に浮かぶ島：草の天面、下へ細る土と石、細い滝。上に何を載せるかは呼ぶ側が決める */
export const FloatingIsland = ({ position, scale, phase, children }: FloatingIslandProps) => {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.5 + phase) * 0.12;
  });
  return (
    <group ref={group} position={position} scale={scale}>
      <Voxel x={0} y={0} z={0} w={1.6} h={0.18} d={1.3} color="#5fb63b" />
      <Voxel x={0} y={-0.32} z={0} w={1.5} h={0.32} d={1.2} color="#8b5a2b" />
      <Voxel x={0.05} y={-0.62} z={0} w={1.1} h={0.3} d={0.9} color="#754a22" />
      <Voxel x={-0.05} y={-0.9} z={0.05} w={0.7} h={0.28} d={0.6} color="#8d8f93" />
      <Voxel x={0.05} y={-1.12} z={0} w={0.35} h={0.22} d={0.3} color="#75777b" />
      <Voxel x={0.55} y={-0.18} z={0.48} w={0.08} h={0.4} d={0.08} color="#3e8f2e" />
      <Voxel x={-0.6} y={-0.26} z={0.5} w={0.08} h={0.5} d={0.08} color="#3e8f2e" />
      <Voxel x={-0.45} y={-1.3} z={0.62} w={0.12} h={1.45} d={0.04} color="#9fe6ff" />
      <group position={[0, 0.18, 0]}>{children}</group>
    </group>
  );
};

const GoldTemple = () => (
  <group position={[0.1, 0, -0.05]}>
    <GoldVoxel x={0} y={0} z={0} w={0.8} h={0.12} d={0.6} color="#f4efe3" metalness={0.2} roughness={0.4} />
    {[-0.3, -0.1, 0.1, 0.3].map((x) => (
      <GoldVoxel key={x} x={x} y={0.12} z={0.22} w={0.06} h={0.34} d={0.06} color="#ffe56a" metalness={0.5} roughness={0.3} />
    ))}
    <GoldVoxel x={0} y={0.12} z={-0.05} w={0.62} h={0.34} d={0.4} color="#f5c842" metalness={0.5} roughness={0.3} />
    <GoldVoxel x={0} y={0.46} z={0} w={0.86} h={0.1} d={0.66} color="#e0a81e" metalness={0.55} roughness={0.3} />
    <GoldVoxel x={0} y={0.56} z={0} w={0.55} h={0.12} d={0.42} color="#f5c842" metalness={0.55} roughness={0.3} />
    <GoldVoxel x={0} y={0.68} z={0} w={0.22} h={0.16} d={0.18} color="#fff1a0" metalness={0.6} roughness={0.25} />
  </group>
);

const PalmPair = () => (
  <>
    <group scale={2.4}>
      <Palm position={[-0.18, 0, -0.1]} />
    </group>
    <group scale={2}>
      <Palm position={[0.25, 0, 0.15]} />
    </group>
  </>
);

const ISLANDS: { position: [number, number, number]; scale: number; phase: number; temple: boolean }[] = [
  { position: [-9.8, 2.6, -2.5], scale: 1.3, phase: 0, temple: true },
  { position: [10.2, 3.2, -3.5], scale: 1.2, phase: 1.7, temple: false },
  { position: [-6.5, 5, -11], scale: 1.6, phase: 3.1, temple: false },
  { position: [7.5, 5.6, -12], scale: 1.5, phase: 4.4, temple: true },
];

/** 黄金郷の空：雲海と浮島 */
export const LuxurySky = () => (
  <group>
    <Clouds />
    {ISLANDS.map(({ position, scale, phase, temple }) => (
      <FloatingIsland key={`${position[0]}-${position[2]}`} position={position} scale={scale} phase={phase}>
        {temple ? <GoldTemple /> : <PalmPair />}
      </FloatingIsland>
    ))}
  </group>
);
