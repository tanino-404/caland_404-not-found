import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { GoldVoxel, Voxel } from '@plugin-sdk';

export interface HelicopterProps {
  position: [number, number, number];
}

/** 屋上ヘリパッドの金ヘリ。ローターが回る */
export const Helicopter = ({ position }: HelicopterProps) => {
  const rotor = useRef<Group>(null);
  useFrame((_, delta) => {
    if (rotor.current) rotor.current.rotation.y += delta * 14;
  });

  return (
    <group position={position}>
      <GoldVoxel x={0} y={0} z={0} w={0.22} h={0.01} d={0.22} color="#c9a227" />
      <GoldVoxel x={0} y={0.01} z={0} w={0.08} h={0.02} d={0.02} color="#ffe066" />
      <GoldVoxel x={0} y={0.01} z={0} w={0.02} h={0.02} d={0.08} color="#ffe066" />
      <GoldVoxel x={0} y={0.04} z={0} w={0.16} h={0.07} d={0.1} color="#ffd24a" />
      <Voxel x={0.02} y={0.07} z={0} w={0.08} h={0.04} d={0.08} color="#1b2a41" />
      <GoldVoxel x={0.12} y={0.06} z={0} w={0.1} h={0.03} d={0.03} color="#e6b422" />
      <group ref={rotor} position={[0, 0.13, 0]}>
        <GoldVoxel x={0} y={0} z={0} w={0.28} h={0.012} d={0.03} color="#fff6dc" metalness={0.4} roughness={0.35} />
        <GoldVoxel x={0} y={0} z={0} w={0.03} h={0.012} d={0.28} color="#fff6dc" metalness={0.4} roughness={0.35} />
      </group>
    </group>
  );
};
