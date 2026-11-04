import { Clouds, FloatingIsland, GoldVoxel, Palm } from '@plugin-sdk';

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
