import { MeshStandardMaterial } from 'three';
import { buildFallers, FloatingIsland, Glints, pixelArtGeometry, PixelRain, type RainItem, type IslandFxProps, SunFlare, useSkyFade, Voxel } from '@plugin-sdk';

// ---------- 降るもの（ドット絵） ----------

/** プロテインのボトル。黒いキャップ、白い胴に赤いラベル */
const BOTTLE_ROWS = [
  '..kkk..',
  '..kkk..',
  '.wwwww.',
  'wwwwwww',
  'wrrrrrw',
  'wryyyrw',
  'wrrrrrw',
  'wwwwwww',
  'wwwwwww',
  'wwwwwww',
  '.wwwww.',
];

const BANANA_ROWS = [
  '........yk',
  '.......yy.',
  '......yyy.',
  'yy...yyy..',
  '.yyyyyyy..',
  '..yyyyy...',
];

const PLASTIC = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.05 });

/** 降らせるのは食べ物と飲み物だけ（重い器具は降らせない） */
const RAIN: RainItem[] = [
  {
    geometry: pixelArtGeometry(BOTTLE_ROWS, { k: '#22201f', w: '#f4f4f4', r: '#d8322a', y: '#ffd23a' }, 6),
    material: PLASTIC,
    fallers: [...buildFallers(11, 65, 0.06, false), ...buildFallers(2, 66, 0.06, true)],
    motion: 'spin',
  },
  {
    geometry: pixelArtGeometry(BANANA_ROWS, { y: '#ffd84a', k: '#5a3a14' }, 2),
    material: PLASTIC,
    fallers: [...buildFallers(10, 67, 0.06, false), ...buildFallers(1, 68, 0.06, true)],
    motion: 'flutter',
  },
];

// ---------- 空のジムの浮島 ----------

const GiantDumbbell = () => (
  <group position={[0, 0.02, 0]}>
    <Voxel x={-0.5} y={0} z={0} w={0.18} h={0.62} d={0.62} color="#1c1d22" />
    <Voxel x={0.5} y={0} z={0} w={0.18} h={0.62} d={0.62} color="#1c1d22" />
    <Voxel x={-0.66} y={0.08} z={0} w={0.14} h={0.46} d={0.46} color="#2b2f36" />
    <Voxel x={0.66} y={0.08} z={0} w={0.14} h={0.46} d={0.46} color="#2b2f36" />
    <Voxel x={0} y={0.26} z={0} w={1.2} h={0.1} d={0.1} color="#c9ced6" />
  </group>
);

const GiantKettlebell = () => (
  <group position={[0, 0.02, 0]}>
    <Voxel x={0} y={0} z={0} w={0.7} h={0.55} d={0.7} color="#2b2f36" />
    <Voxel x={0} y={0.55} z={0} w={0.55} h={0.1} d={0.55} color="#2b2f36" />
    <Voxel x={-0.2} y={0.65} z={0} w={0.1} h={0.3} d={0.1} color="#2b2f36" />
    <Voxel x={0.2} y={0.65} z={0} w={0.1} h={0.3} d={0.1} color="#2b2f36" />
    <Voxel x={0} y={0.92} z={0} w={0.5} h={0.1} d={0.1} color="#2b2f36" />
    <Voxel x={-0.22} y={0.18} z={0.36} w={0.12} h={0.2} d={0.01} color="#6a707c" />
  </group>
);

const SquatRack = () => (
  <group position={[0, 0.02, 0]}>
    {[-0.5, 0.5].map((x) => (
      <Voxel key={x} x={x} y={0} z={0} w={0.07} h={0.9} d={0.07} color="#1c1d22" />
    ))}
    <Voxel x={0} y={0.88} z={0} w={1.1} h={0.06} d={0.07} color="#1c1d22" />
    <Voxel x={0} y={0.6} z={0.06} w={1.4} h={0.05} d={0.05} color="#c9ced6" />
    {[-0.66, 0.66].map((x) => (
      <Voxel key={x} x={x} y={0.46} z={0.06} w={0.1} h={0.34} d={0.34} color="#d8322a" />
    ))}
    <Voxel x={0} y={0} z={0.35} w={0.6} h={0.12} d={0.22} color="#2a52be" />
  </group>
);

const GYM_ISLANDS: { position: [number, number, number]; scale: number; phase: number; top: 'dumbbell' | 'kettlebell' | 'rack' }[] = [
  { position: [-9.8, 2.6, -2.5], scale: 1.3, phase: 0, top: 'dumbbell' },
  { position: [10.2, 3.2, -3.5], scale: 1.2, phase: 1.7, top: 'kettlebell' },
  { position: [-6.8, 5.2, -11.5], scale: 1.6, phase: 3.1, top: 'rack' },
  { position: [7.8, 5.8, -12.5], scale: 1.5, phase: 4.4, top: 'dumbbell' },
];

/** マッチョの島の空：降るプロテインのボトルとバナナ、きらめき、太陽、ジムの浮島。降るものは active でフェードする */
export const MuscleFx = ({ active, flare }: IslandFxProps) => {
  const { fade, group } = useSkyFade(active);
  return (
    <group>
      <group ref={group} visible={false}>
        <PixelRain items={RAIN} fade={fade} />
        <Glints fade={fade} />
        {flare ? <SunFlare /> : null}
      </group>
      {GYM_ISLANDS.map(({ position, scale, phase, top }) => (
        <FloatingIsland key={`${position[0]}-${position[2]}`} position={position} scale={scale} phase={phase}>
          {top === 'dumbbell' ? <GiantDumbbell /> : top === 'kettlebell' ? <GiantKettlebell /> : <SquatRack />}
        </FloatingIsland>
      ))}
    </group>
  );
};
