import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { Helicopter } from './Helicopter';
import { Yacht } from './Yacht';
import { SEA_Y } from '@plugin-sdk';

const YACHTS: { position: [number, number, number]; yaw: number; scale: number }[] = [
  { position: [-4.6, SEA_Y + 0.02, 2.6], yaw: 0.5, scale: 1.7 },
  { position: [4.4, SEA_Y + 0.02, 2.2], yaw: -0.8, scale: 2.1 },
  { position: [3.8, SEA_Y + 0.02, -3.6], yaw: 1.2, scale: 1.5 },
  { position: [-4.2, SEA_Y + 0.02, -3.2], yaw: 2.2, scale: 1.6 },
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

/** 近くのヨットと空のヘリ */
export const LuxuryMarina = () => (
  <group>
    {YACHTS.map((yacht) => (
      <group key={`${yacht.position[0]}-${yacht.position[2]}`} position={yacht.position} scale={yacht.scale}>
        <Yacht position={[0, 0, 0]} yaw={yacht.yaw} />
      </group>
    ))}
    <FlyingHeli />
  </group>
);
