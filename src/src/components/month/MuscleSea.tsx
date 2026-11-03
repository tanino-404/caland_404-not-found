import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, type Group, type InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { WATER_TOP_Y } from '../../lib/camera';
import { UNIT_BOX } from '../models/materials';
import { pixelArtGeometry } from '../models/pixelArt';
import { Voxel } from '../models/Voxel';

// ---------- 競泳レーン ----------

const LANE_COUNT = 4;
const LANE_GAP = 0.42;
const LANE_HALF = 3.2;
const FLOAT_STEP = 0.16;
const FLOATS_PER_ROPE = Math.floor((LANE_HALF * 2) / FLOAT_STEP) + 1;
const ROPE_RED = new Color('#e8402e');
const ROPE_WHITE = new Color('#f4f4f4');
const ROPE_BLUE = new Color('#2a7fd4');
const ROPE_MAT = new MeshStandardMaterial({ roughness: 0.6 });

/** レーンを区切るブイのロープ。端は赤、内側は白と青の交互 */
const LaneRopes = ({ z0 }: { z0: number }) => {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) {
      throw new Error('MuscleSea: ロープのメッシュがありません');
    }
    const o = new Object3D();
    let i = 0;
    for (let rope = 0; rope <= LANE_COUNT; rope++) {
      for (let k = 0; k < FLOATS_PER_ROPE; k++) {
        o.position.set(-LANE_HALF + k * FLOAT_STEP, WATER_TOP_Y + 0.01, z0 + rope * LANE_GAP);
        o.scale.set(0.1, 0.07, 0.07);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        const edge = k < 3 || k >= FLOATS_PER_ROPE - 3;
        m.setColorAt(i, edge ? ROPE_RED : k % 2 === 0 ? ROPE_WHITE : ROPE_BLUE);
        i++;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [z0]);
  return <instancedMesh ref={mesh} args={[UNIT_BOX, ROPE_MAT, (LANE_COUNT + 1) * FLOATS_PER_ROPE]} />;
};

/** クロールで往復する人。腕が回り、足元にしぶき */
const Swimmer = ({ z, cap, phase }: { z: number; cap: string; phase: number }) => {
  const body = useRef<Group>(null);
  const armA = useRef<Group>(null);
  const armB = useRef<Group>(null);
  const splash = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.32 + phase;
    const g = body.current;
    if (!g) return;
    g.position.x = Math.sin(t) * (LANE_HALF - 0.45);
    g.rotation.y = Math.cos(t) >= 0 ? 0 : Math.PI;
    const stroke = clock.elapsedTime * 5 + phase;
    if (armA.current) armA.current.rotation.z = stroke;
    if (armB.current) armB.current.rotation.z = stroke + Math.PI;
    if (splash.current) splash.current.scale.y = 0.6 + Math.abs(Math.sin(stroke * 1.3)) * 0.8;
  });
  return (
    <group ref={body} position={[0, WATER_TOP_Y - 0.02, z]}>
      <Voxel x={0} y={0} z={0} w={0.3} h={0.06} d={0.1} color="#1f3f8a" />
      <Voxel x={0.18} y={0.01} z={0} w={0.08} h={0.08} d={0.08} color="#f0a878" />
      <Voxel x={0.19} y={0.05} z={0} w={0.08} h={0.04} d={0.085} color={cap} />
      <group ref={armA} position={[0.1, 0.03, 0.06]}>
        <Voxel x={0.08} y={-0.02} z={0} w={0.16} h={0.04} d={0.04} color="#f0a878" />
      </group>
      <group ref={armB} position={[0.1, 0.03, -0.06]}>
        <Voxel x={0.08} y={-0.02} z={0} w={0.16} h={0.04} d={0.04} color="#f0a878" />
      </group>
      <group ref={splash} position={[-0.22, 0.02, 0]}>
        <Voxel x={0} y={0} z={0} w={0.1} h={0.06} d={0.12} color="#ffffff" />
      </group>
    </group>
  );
};

// ---------- ボクシングリングの浮き台 ----------

const BOXER_ROWS = [
  '...kkk...',
  '...sss...',
  '...sss...',
  'gg.sss.gg',
  'gg.sss.gg',
  '.sssssss.',
  '..sssss..',
  '..sssss..',
  '..ttttt..',
  '..tt.tt..',
  '..ss.ss..',
  '..ss.ss..',
  '.kkk.kkk.',
];
const BOXER_MAT = new MeshStandardMaterial({ vertexColors: true, roughness: 0.65, emissive: '#ffffff', emissiveIntensity: 0.06 });
const RED_BOXER = pixelArtGeometry(BOXER_ROWS, { k: '#22201f', s: '#f0a878', g: '#d8322a', t: '#d8322a' }, 4);
const BLUE_BOXER = pixelArtGeometry(BOXER_ROWS, { k: '#22201f', s: '#c87850', g: '#2a52be', t: '#2a52be' }, 4);

const Boxers = () => {
  const red = useRef<Group>(null);
  const blue = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (red.current) {
      red.current.position.x = -0.26 + Math.max(0, Math.sin(t * 3)) * 0.08;
      red.current.position.y = 0.3 + Math.abs(Math.sin(t * 6)) * 0.03;
    }
    if (blue.current) {
      blue.current.position.x = 0.26 - Math.max(0, Math.sin(t * 3 + 1.6)) * 0.08;
      blue.current.position.y = 0.3 + Math.abs(Math.sin(t * 6 + 1)) * 0.03;
    }
  });
  const pixel = 0.042;
  const half = (BOXER_ROWS.length * pixel) / 2;
  return (
    <>
      <group ref={red} position={[-0.26, 0.3, 0]}>
        <mesh geometry={RED_BOXER} material={BOXER_MAT} position={[0, half, 0]} scale={pixel} />
      </group>
      <group ref={blue} position={[0.26, 0.3, 0]}>
        <mesh geometry={BLUE_BOXER} material={BOXER_MAT} position={[0, half, 0]} scale={pixel} />
      </group>
    </>
  );
};

const RING_ROPES = ['#d8322a', '#f4f4f4', '#2a52be'];

const BoxingRing = ({ position }: { position: [number, number, number] }) => (
  <group position={position} rotation={[0, -0.35, 0]}>
    <Voxel x={0} y={-0.1} z={0} w={1.6} h={0.36} d={1.6} color="#5f646c" />
    <Voxel x={0} y={0.26} z={0} w={1.5} h={0.04} d={1.5} color="#f4f4f4" />
    <Voxel x={0} y={0.27} z={0} w={1.3} h={0.04} d={1.3} color="#3a78d8" />
    {[
      [-0.68, -0.68, '#d8322a'],
      [0.68, -0.68, '#2a52be'],
      [-0.68, 0.68, '#2a52be'],
      [0.68, 0.68, '#d8322a'],
    ].map(([x, z, color]) => (
      <Voxel key={`${x}-${z}`} x={x as number} y={0.26} z={z as number} w={0.07} h={0.5} d={0.07} color={color as string} />
    ))}
    {RING_ROPES.map((color, level) => {
      const y = 0.4 + level * 0.11;
      return (
        <group key={color}>
          <Voxel x={0} y={y} z={-0.68} w={1.36} h={0.02} d={0.02} color={color} />
          <Voxel x={0} y={y} z={0.68} w={1.36} h={0.02} d={0.02} color={color} />
          <Voxel x={-0.68} y={y} z={0} w={0.02} h={0.02} d={1.36} color={color} />
          <Voxel x={0.68} y={y} z={0} w={0.02} h={0.02} d={1.36} color={color} />
        </group>
      );
    })}
    <Boxers />
  </group>
);

// ---------- 監視塔と浮かぶダンベル ----------

const LifeguardTower = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <Voxel x={0} y={-0.08} z={0} w={1.2} h={0.2} d={0.9} color="#f2d59a" />
    {[
      [-0.22, -0.18],
      [0.22, -0.18],
      [-0.22, 0.18],
      [0.22, 0.18],
    ].map(([x, z]) => (
      <Voxel key={`${x}-${z}`} x={x} y={0.12} z={z} w={0.05} h={0.8} d={0.05} color="#f4f4f4" />
    ))}
    <Voxel x={0} y={0.9} z={0} w={0.6} h={0.06} d={0.5} color="#f4f4f4" />
    <Voxel x={0} y={0.96} z={-0.05} w={0.52} h={0.32} d={0.4} color="#e8402e" />
    <Voxel x={0} y={1.06} z={0.16} w={0.4} h={0.12} d={0.01} color="#7fd6ff" />
    <Voxel x={0} y={1.28} z={0} w={0.7} h={0.06} d={0.6} color="#f4f4f4" />
    <Voxel x={0.3} y={1.34} z={0} w={0.02} h={0.4} d={0.02} color="#5a5f68" />
    <Voxel x={0.39} y={1.6} z={0} w={0.16} h={0.12} d={0.01} color="#e8402e" />
    <Voxel x={0.34} y={0.12} z={0.36} w={0.14} h={0.14} d={0.03} color="#e8402e" />
  </group>
);

const FloatingDumbbell = ({ position, phase }: { position: [number, number, number]; phase: number }) => {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.position.y = position[1] + Math.sin(t * 1.1 + phase) * 0.05;
    g.rotation.z = Math.sin(t * 0.8 + phase) * 0.08;
  });
  return (
    <group ref={group} position={position} rotation={[0, phase, 0]}>
      <Voxel x={-0.42} y={-0.2} z={0} w={0.16} h={0.5} d={0.5} color="#1c1d22" />
      <Voxel x={0.42} y={-0.2} z={0} w={0.16} h={0.5} d={0.5} color="#1c1d22" />
      <Voxel x={0} y={-0.01} z={0} w={0.7} h={0.08} d={0.08} color="#c9ced6" />
    </group>
  );
};

export interface MuscleSeaProps {
  rows: number;
}

/** マッチョの島の海：競泳レーンと泳ぐ人、ボクシングリングの浮き台、監視塔、浮かぶダンベル */
export const MuscleSea = ({ rows }: MuscleSeaProps) => {
  const front = rows / 2;
  const laneZ0 = front + 1.25;
  const caps = useMemo(() => ['#d8322a', '#ffd23a', '#2a52be', '#f4f4f4'], []);
  return (
    <group>
      <LaneRopes z0={laneZ0} />
      {caps.map((cap, lane) => (
        <Swimmer key={cap} z={laneZ0 + LANE_GAP * (lane + 0.5)} cap={cap} phase={lane * 1.9} />
      ))}
      <BoxingRing position={[4.9, 0, front + 0.7]} />
      <LifeguardTower position={[-4.9, 0, front + 2.2]} />
      <FloatingDumbbell position={[-6.4, WATER_TOP_Y, -0.6]} phase={0.6} />
      <FloatingDumbbell position={[6.6, WATER_TOP_Y, -2.2]} phase={2.1} />
      <FloatingDumbbell position={[2.2, WATER_TOP_Y, front + 3.6]} phase={4} />
    </group>
  );
};
