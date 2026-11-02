import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { SEA_Y } from '../../lib/camera';
import { GoldVoxel } from '../models/luxury/GoldVoxel';
import { Helicopter } from '../models/luxury/Helicopter';
import { Palm } from '../models/luxury/Palm';
import { Yacht } from '../models/luxury/Yacht';

const YACHTS: { position: [number, number, number]; yaw: number; scale: number }[] = [
  { position: [-4.6, SEA_Y + 0.02, 2.6], yaw: 0.5, scale: 1.7 },
  { position: [4.4, SEA_Y + 0.02, 2.2], yaw: -0.8, scale: 2.1 },
  { position: [3.8, SEA_Y + 0.02, -3.6], yaw: 1.2, scale: 1.5 },
  { position: [-4.2, SEA_Y + 0.02, -3.2], yaw: 2.2, scale: 1.6 },
];

const ISLETS: [number, number, number][] = [
  [6.4, 2.4, -2.2],
  [-6.6, 3.1, 1.4],
  [5.8, 3.6, 4.2],
];

const FlyingHeli = () => {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.22;
    g.position.set(Math.cos(t) * 4.8, 5.4, Math.sin(t) * 4.2);
    g.rotation.y = -t - Math.PI / 2;
  });
  return (
    <group ref={group} scale={2.6}>
      <Helicopter position={[0, 0, 0]} />
    </group>
  );
};

const Islet = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <GoldVoxel x={0} y={0} z={0} w={0.7} h={0.28} d={0.55} color="#f0c43a" />
    <GoldVoxel x={0.18} y={0.28} z={-0.05} w={0.36} h={0.22} d={0.32} color="#ffe56a" />
    <Palm position={[0.05, 0.28, 0.08]} />
  </group>
);

/** 近くのヨット、空のヘリ、遠くの浮島 */
export const LuxuryMarina = () => (
  <group>
    {YACHTS.map((yacht) => (
      <group key={`${yacht.position[0]}-${yacht.position[2]}`} position={yacht.position} scale={yacht.scale}>
        <Yacht position={[0, 0, 0]} yaw={yacht.yaw} />
      </group>
    ))}
    {ISLETS.map((position) => (
      <Islet key={`${position[0]}-${position[2]}`} position={position} />
    ))}
    <FlyingHeli />
  </group>
);
