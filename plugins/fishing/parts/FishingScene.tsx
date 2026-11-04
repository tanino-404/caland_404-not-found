import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { type Group, MeshStandardMaterial } from 'three';
import { Glow, LampPost, Palm, pixelArtGeometry, SEA_Y, Voxel, WATER_TOP_Y, WaterfallCliff } from '@plugin-sdk';

type Vec3 = [number, number, number];

const WOOD = '#a8743a';
const WOOD_LIGHT = '#c48b4a';
const WOOD_DARK = '#6b4422';
const WHITE = '#f6f3ea';
const MARINE = '#2a5fc4';
const MARINE_DARK = '#1d3f8a';
const STONE = '#8d949c';
const GRASS = '#5fb63b';

/** 桟橋の床の高さ（海面より少し上） */
const DECK_Y = 0.32;

// ---------- ドット絵の大きな魚 ----------

/** 右を向いたクロマグロ。d 背、b 青、s 銀の腹、y 黄色の小離鰭 */
const TUNA_ROWS = [
  '..........d.........',
  '.........dd.........',
  'd.......dddd........',
  'dd....ddddddddd.....',
  '.dd.dddbbbbbbbbbd...',
  '..ddbbbbbbbbbbbbbbe.',
  '..ddssssssssssssssss',
  '.dd.yssssssssssssss.',
  'dd...y.sssssss......',
  'd.......ss..........',
];

/** 右を向いたカジキ。長い吻 k */
const MARLIN_ROWS = [
  '......d...................',
  '.....ddd..................',
  '....ddddd.................',
  'd..dddddddd...............',
  'dd.ddbbbbbbbbbd...........',
  '.dddbbbbbbbbbbbbbe........',
  '.ddbbssssssssssssskkkkkkkk',
  'dd..sssssssssssss.........',
  'd.....ss....s.............',
];

const FISH_MAT = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
const TUNA_GEO = pixelArtGeometry(
  TUNA_ROWS,
  { d: '#1d2f6b', b: '#2f63c9', s: '#d4dde8', y: '#ffd23a', e: '#111111' },
  2,
);
const MARLIN_GEO = pixelArtGeometry(
  MARLIN_ROWS,
  { d: '#16306e', b: '#2a6fd6', s: '#e2eaf3', e: '#111111', k: '#1b2a41' },
  2,
);

// ---------- 人と小物 ----------

/** 竿を海へ出した釣り人。竿先がゆれ、ウキが浮き沈みする */
const Angler = ({ position, yaw, shirt, hat, phase }: { position: Vec3; yaw: number; shirt: string; hat: string; phase: number }) => {
  const rod = useRef<Group>(null);
  const float = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (rod.current) rod.current.rotation.x = 0.95 + Math.sin(t * 1.3) * 0.06 + (Math.sin(t * 0.4) > 0.93 ? -0.35 : 0);
    if (float.current) float.current.position.y = WATER_TOP_Y - DECK_Y + Math.max(0, Math.sin(t * 2.2)) * 0.03;
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <Voxel x={-0.035} y={0} z={0} w={0.05} h={0.14} d={0.06} color="#2b3d66" />
      <Voxel x={0.035} y={0} z={0} w={0.05} h={0.14} d={0.06} color="#2b3d66" />
      <Voxel x={0} y={0.14} z={0} w={0.14} h={0.17} d={0.09} color={shirt} />
      <Voxel x={0} y={0.31} z={0} w={0.1} h={0.1} d={0.1} color="#f0b080" />
      <Voxel x={0} y={0.4} z={0} w={0.14} h={0.03} d={0.14} color={hat} />
      <Voxel x={0} y={0.43} z={0} w={0.09} h={0.04} d={0.09} color={hat} />
      <group ref={rod} position={[0.05, 0.24, 0.06]}>
        <Voxel x={0} y={0} z={0} w={0.02} h={0.7} d={0.02} color="#3a2a18" />
      </group>
      {/* 糸は竿先（おおよそ前方 0.55）から真下の水面まで */}
      <Voxel x={0.05} y={WATER_TOP_Y - DECK_Y} z={0.6} w={0.008} h={0.75} d={0.008} color="#e8f4ff" />
      <group ref={float} position={[0.05, WATER_TOP_Y - DECK_Y, 0.6]}>
        <Voxel x={0} y={0} z={0} w={0.05} h={0.03} d={0.05} color="#ffffff" />
        <Voxel x={0} y={0.03} z={0} w={0.05} h={0.03} d={0.05} color="#e8402e" />
      </group>
    </group>
  );
};

/** 釣った大物を掲げる釣り人 */
const Trophy = ({ position, yaw }: { position: Vec3; yaw: number }) => {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = position[1] + Math.abs(Math.sin(clock.elapsedTime * 2.4)) * 0.05;
  });
  return (
    <group ref={group} position={position} rotation={[0, yaw, 0]}>
      <Voxel x={0} y={0} z={0} w={0.13} h={0.14} d={0.07} color="#2b3d66" />
      <Voxel x={0} y={0.14} z={0} w={0.14} h={0.17} d={0.09} color="#e8402e" />
      <Voxel x={0} y={0.31} z={0} w={0.1} h={0.1} d={0.1} color="#f0b080" />
      <Voxel x={0} y={0.41} z={0} w={0.11} h={0.04} d={0.11} color="#fff1c2" />
      <Voxel x={-0.09} y={0.3} z={0.02} w={0.04} h={0.18} d={0.04} color="#e8402e" />
      <Voxel x={0.09} y={0.3} z={0.02} w={0.04} h={0.18} d={0.04} color="#e8402e" />
      <mesh geometry={TUNA_GEO} material={FISH_MAT} position={[0, 0.52, 0.06]} scale={0.022} />
    </group>
  );
};

/** 魚の入ったトロ箱。氷の上に魚を並べる */
const FishCrate = ({ position, fish }: { position: Vec3; fish: string }) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.26} h={0.08} d={0.18} color={WOOD_LIGHT} />
    <Voxel x={0} y={0.08} z={0} w={0.22} h={0.01} d={0.14} color="#e8fbff" />
    <Voxel x={-0.05} y={0.09} z={-0.03} w={0.1} h={0.03} d={0.04} color={fish} />
    <Voxel x={0.05} y={0.09} z={0.03} w={0.1} h={0.03} d={0.04} color={fish} />
  </group>
);

/** 漁船：赤い船底、白い船体、操舵室、マストと大漁旗 */
const FishingBoat = ({ hull }: { hull: string }) => (
  <group>
    <Voxel x={0} y={-0.06} z={0} w={1.0} h={0.12} d={0.4} color={hull} />
    <Voxel x={0.06} y={0.06} z={0} w={1.04} h={0.12} d={0.44} color={WHITE} />
    <Voxel x={0.56} y={0.06} z={0} w={0.12} h={0.1} d={0.28} color={WHITE} />
    <Voxel x={-0.18} y={0.18} z={0} w={0.34} h={0.26} d={0.32} color={WHITE} />
    <Glow x={-0.01} y={0.28} z={0} w={0.01} h={0.1} d={0.24} color="#9fe3ff" />
    <Voxel x={-0.18} y={0.44} z={0} w={0.4} h={0.04} d={0.38} color={MARINE} />
    <Voxel x={0.2} y={0.18} z={0} w={0.03} h={0.6} d={0.03} color="#3a2a18" />
    <Voxel x={0.2} y={0.6} z={0.1} w={0.02} h={0.16} d={0.2} color="#e8402e" />
    <Voxel x={0.2} y={0.64} z={0.11} w={0.022} h={0.06} d={0.08} color="#ffd23a" />
    <FishCrate position={[0.35, 0.18, 0]} fish="#c9d6e6" />
  </group>
);

// ---------- 桟橋 ----------

const PLANK_STEP = 0.18;

/** 板を並べた歩道。axis の向きに len だけ伸びる。杭は 0.7 おき */
const Boardwalk = ({ from, axis, len, width }: { from: Vec3; axis: 'x' | 'z'; len: number; width: number }) => {
  const sign = len < 0 ? -1 : 1;
  const count = Math.floor(Math.abs(len) / PLANK_STEP);
  const posts = Math.floor(Math.abs(len) / 0.7) + 1;
  const at = (k: number, side: number): Vec3 =>
    axis === 'x' ? [from[0] + sign * k, 0, from[2] + side] : [from[0] + side, 0, from[2] + sign * k];
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const [x, , z] = at(i * PLANK_STEP + PLANK_STEP / 2, 0);
        return (
          <Voxel
            key={i}
            x={x}
            y={DECK_Y - 0.06}
            z={z}
            w={axis === 'x' ? PLANK_STEP - 0.02 : width}
            h={0.06}
            d={axis === 'x' ? width : PLANK_STEP - 0.02}
            color={i % 3 === 0 ? WOOD_LIGHT : WOOD}
          />
        );
      })}
      {Array.from({ length: posts }, (_, i) =>
        [-width / 2, width / 2].map((side) => {
          const [x, , z] = at(i * 0.7 + 0.1, side);
          return <Voxel key={`${i}-${side}`} x={x} y={SEA_Y - 0.3} z={z} w={0.08} h={DECK_Y + 0.38} d={0.08} color={WOOD_DARK} />;
        }),
      )}
    </group>
  );
};

/** 島の左手前から海へ伸びる桟橋。釣り人が並び、先に漁船がつながれている */
const FishingPier = ({ rows }: { rows: number }) => {
  const front = rows / 2;
  const mainZ = front - 1.1;
  const branchX = -5.9;
  const moored = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = moored.current;
    if (!g) return;
    g.position.y = SEA_Y + 0.06 + Math.sin(clock.elapsedTime * 1.4) * 0.025;
    g.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.04;
  });
  return (
    <group>
      <Boardwalk from={[-3.5, 0, mainZ]} axis="x" len={-3.4} width={0.8} />
      <Boardwalk from={[branchX, 0, mainZ + 0.4]} axis="z" len={2.3} width={0.7} />
      <Angler position={[-4.3, DECK_Y, mainZ - 0.3]} yaw={Math.PI} shirt="#e8402e" hat="#ffd23a" phase={0} />
      <Angler position={[-5.0, DECK_Y, mainZ - 0.3]} yaw={Math.PI} shirt="#2e86de" hat="#ffffff" phase={1.7} />
      <Angler position={[-6.7, DECK_Y, mainZ + 0.1]} yaw={-Math.PI / 2} shirt="#5fb63b" hat="#e8402e" phase={3.1} />
      <Angler position={[branchX - 0.25, DECK_Y, mainZ + 1.5]} yaw={-Math.PI / 2} shirt="#ff8a3d" hat="#2b3d66" phase={4.4} />
      <Angler position={[branchX + 0.25, DECK_Y, mainZ + 2.2]} yaw={Math.PI / 2} shirt="#ffd23a" hat="#e8402e" phase={2.3} />
      <Trophy position={[-4.6, DECK_Y, mainZ + 0.2]} yaw={0.4} />
      <FishCrate position={[-3.8, DECK_Y, mainZ + 0.25]} fish="#e8402e" />
      <FishCrate position={[-5.5, DECK_Y, mainZ + 0.25]} fish="#c9d6e6" />
      <LampPost position={[-3.7, DECK_Y, mainZ - 0.32]} />
      <LampPost position={[branchX + 0.3, DECK_Y, mainZ + 2.6]} />
      <group ref={moored} position={[branchX - 0.85, SEA_Y + 0.06, mainZ + 2.5]} rotation={[0, Math.PI / 2, 0]} scale={1.1}>
        <FishingBoat hull="#e8402e" />
      </group>
    </group>
  );
};

// ---------- 海と空の生きもの ----------

/** 海から弧を描いて跳ねるカジキ。着水点に白いしぶき */
const LeapingMarlin = ({ position, yaw, phase }: { position: Vec3; yaw: number; phase: number }) => {
  const fish = useRef<Group>(null);
  const splash = useRef<Group>(null);
  useFrame(({ clock }) => {
    const k = ((clock.elapsedTime + phase) / 5) % 1;
    const g = fish.current;
    const s = splash.current;
    if (!g || !s) return;
    const jump = Math.min(1, k / 0.45);
    g.visible = k < 0.45;
    g.position.set((jump - 0.5) * 2.4, Math.sin(jump * Math.PI) * 1.5 - 0.1, 0);
    g.rotation.z = Math.cos(jump * Math.PI) * 0.9;
    const splashK = k < 0.45 ? jump : 1;
    s.visible = splashK < 0.12 || splashK > 0.9;
    s.position.x = (splashK < 0.5 ? -0.5 : 0.5) * 2.4;
    s.scale.setScalar(0.6 + ((k * 7) % 1) * 0.6);
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group ref={fish}>
        <mesh geometry={MARLIN_GEO} material={FISH_MAT} scale={0.06} />
      </group>
      <group ref={splash} position={[0, WATER_TOP_Y, 0]}>
        <Glow x={0} y={0} z={0} w={0.5} h={0.12} d={0.5} color="#ffffff" />
        <Glow x={0} y={0.12} z={0} w={0.22} h={0.22} d={0.22} color="#d8f6ff" />
      </group>
    </group>
  );
};

/** 空をゆっくり羽ばたいて周るマンタ */
const SkyManta = () => {
  const body = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = t * 0.12;
    if (body.current) {
      body.current.position.set(Math.cos(a) * 7.5, 4.6 + Math.sin(t * 0.7) * 0.3, Math.sin(a) * 5.5 - 1);
      body.current.rotation.y = -a - Math.PI / 2;
    }
    const flap = Math.sin(t * 1.8) * 0.35;
    if (left.current) left.current.rotation.x = flap;
    if (right.current) right.current.rotation.x = -flap;
  });
  return (
    <group ref={body} scale={1.6}>
      <Voxel x={0} y={0} z={0} w={0.5} h={0.1} d={0.3} color="#3a3f4a" />
      <Voxel x={0} y={-0.01} z={0} w={0.44} h={0.02} d={0.26} color="#f2f2f2" />
      <Voxel x={-0.33} y={0} z={-0.04} w={0.16} h={0.03} d={0.04} color="#3a3f4a" />
      <group ref={left} position={[0, 0.03, -0.15]}>
        <Voxel x={0} y={0} z={-0.25} w={0.34} h={0.04} d={0.5} color="#3a3f4a" />
        <Voxel x={0.06} y={0} z={-0.55} w={0.16} h={0.03} d={0.14} color="#3a3f4a" />
      </group>
      <group ref={right} position={[0, 0.03, 0.15]}>
        <Voxel x={0} y={0} z={0.25} w={0.34} h={0.04} d={0.5} color="#3a3f4a" />
        <Voxel x={0.06} y={0} z={0.55} w={0.16} h={0.03} d={0.14} color="#3a3f4a" />
      </group>
      <Voxel x={-0.55} y={0.02} z={0} w={0.5} h={0.02} d={0.02} color="#2b2f36" />
    </group>
  );
};

/** 沖を周る漁船 */
const CruisingBoat = ({ rows, phase, hull }: { rows: number; phase: number; hull: string }) => {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const a = clock.elapsedTime * 0.07 + phase;
    g.position.set(Math.cos(a) * 8.2, SEA_Y + 0.06 + Math.sin(clock.elapsedTime * 1.3 + phase) * 0.02, Math.sin(a) * (rows / 2 + 4.2));
    g.rotation.y = -a - Math.PI / 2;
  });
  return (
    <group ref={group} scale={1.3}>
      <FishingBoat hull={hull} />
    </group>
  );
};

// ---------- 島の奥の漁村 ----------

/** 青と白の縞のテントの魚市場。台に魚が並ぶ */
const FishMarket = ({ position }: { position: Vec3 }) => {
  const stripes = 9;
  const width = 2.0;
  return (
    <group position={position}>
      <Voxel x={0} y={0} z={0} w={width + 0.1} h={0.06} d={1.2} color="#d8d2c2" />
      {[-0.95, 0.95].map((x) =>
        [-0.5, 0.5].map((z) => <Voxel key={`${x}-${z}`} x={x} y={0.06} z={z} w={0.08} h={0.7} d={0.08} color={WHITE} />),
      )}
      {Array.from({ length: stripes }, (_, i) => (
        <Voxel
          key={i}
          x={-width / 2 + (i + 0.5) * (width / stripes)}
          y={0.76}
          z={0}
          w={width / stripes}
          h={0.12}
          d={1.3}
          color={i % 2 === 0 ? MARINE : WHITE}
        />
      ))}
      <Voxel x={0} y={0.88} z={0} w={1.6} h={0.12} d={0.9} color={WHITE} />
      <Voxel x={0} y={1.0} z={0} w={1.0} h={0.1} d={0.5} color={MARINE} />
      {/* 正面の看板：魚の紋 */}
      <Voxel x={0} y={0.62} z={0.66} w={0.8} h={0.14} d={0.03} color={MARINE_DARK} />
      <Voxel x={0} y={0.66} z={0.68} w={0.3} h={0.06} d={0.01} color="#fff1c2" />
      <Voxel x={0.18} y={0.65} z={0.68} w={0.06} h={0.08} d={0.01} color="#fff1c2" />
      <Voxel x={0} y={0.06} z={0.15} w={1.6} h={0.22} d={0.4} color={WOOD} />
      {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
        <FishCrate key={x} position={[x, 0.28, 0.15]} fish={['#c9d6e6', '#e8402e', '#2f63c9', '#ffd23a'][i]} />
      ))}
      <Voxel x={-0.5} y={0.06} z={0.55} w={0.12} h={0.3} d={0.08} color="#2b3d66" />
      <Voxel x={-0.5} y={0.36} z={0.55} w={0.1} h={0.1} d={0.1} color="#f0b080" />
      <Voxel x={-0.5} y={0.46} z={0.55} w={0.12} h={0.03} d={0.12} color="#ffffff" />
    </group>
  );
};

/** 漁村の家：板壁、灯りの窓、色の付いた三角屋根 */
const House = ({ position, roof, wall, scale = 1 }: { position: Vec3; roof: string; wall: string; scale?: number }) => (
  <group position={position} scale={scale}>
    <Voxel x={0} y={0} z={0} w={0.9} h={0.7} d={0.8} color={wall} />
    <Glow x={-0.22} y={0.32} z={0.41} w={0.18} h={0.18} d={0.01} color="#ffd98a" />
    <Glow x={0.22} y={0.32} z={0.41} w={0.18} h={0.18} d={0.01} color="#ffd98a" />
    <Voxel x={0} y={0} z={0.41} w={0.2} h={0.32} d={0.02} color={WOOD_DARK} />
    <Voxel x={0} y={0.7} z={0} w={1.04} h={0.14} d={0.94} color={roof} />
    <Voxel x={0} y={0.84} z={0} w={0.74} h={0.14} d={0.94} color={roof} />
    <Voxel x={0} y={0.98} z={0} w={0.42} h={0.12} d={0.94} color={roof} />
    <Voxel x={0.28} y={0.84} z={-0.2} w={0.12} h={0.36} d={0.12} color={STONE} />
  </group>
);

/** 水族館：白い建物に大きな水槽のガラス、屋上のプールで魚が泳ぐ */
const Aquarium = ({ position }: { position: Vec3 }) => {
  const fish = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = fish.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const a = clock.elapsedTime * (0.6 + i * 0.15) + i * 2.1;
      child.position.set(Math.cos(a) * 0.7, 0.15 + (i % 3) * 0.18, 0.62);
      child.rotation.y = Math.sin(a) > 0 ? Math.PI : 0;
    });
  });
  return (
    <group position={position}>
      <Voxel x={0} y={0} z={0} w={2.4} h={1.3} d={1.5} color={WHITE} />
      <Glow x={0} y={0.12} z={0.755} w={1.9} h={0.8} d={0.02} color="#4fc3f7" />
      <Glow x={0} y={0.12} z={0.765} w={1.9} h={0.1} d={0.01} color="#e0b070" />
      <group ref={fish}>
        {['#ff8a3d', '#ffd23a', '#e8402e', '#7fe0ff', '#ff8fb1'].map((color) => (
          <Voxel key={color} x={0} y={0} z={0} w={0.12} h={0.06} d={0.02} color={color} />
        ))}
      </group>
      <Voxel x={0} y={1.0} z={0.77} w={2.4} h={0.1} d={0.03} color={MARINE} />
      <Voxel x={0} y={1.3} z={0} w={2.5} h={0.08} d={1.6} color={MARINE} />
      <Voxel x={0.3} y={1.38} z={0} w={1.6} h={0.12} d={1.2} color={WHITE} />
      <Glow x={0.3} y={1.42} z={0} w={1.4} h={0.09} d={1.0} color="#5fd0f5" />
      <Voxel x={-0.85} y={1.38} z={-0.3} w={0.6} h={0.6} d={0.7} color={WHITE} />
      <Glow x={-0.85} y={1.56} z={0.06} w={0.5} h={0.3} d={0.01} color="#9fe3ff" />
      <Voxel x={-0.85} y={1.98} z={-0.3} w={0.66} h={0.08} d={0.76} color={MARINE} />
    </group>
  );
};

/** 赤白の灯台。光がゆっくり回る */
const Lighthouse = ({ position }: { position: Vec3 }) => {
  const beam = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (beam.current) beam.current.rotation.y = clock.elapsedTime * 0.8;
  });
  return (
    <group position={position}>
      <Voxel x={0} y={-0.3} z={0} w={1.3} h={0.6} d={1.1} color={STONE} />
      <Voxel x={0} y={0.3} z={0} w={1.32} h={0.04} d={1.12} color={GRASS} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Voxel key={i} x={0} y={0.34 + i * 0.36} z={0} w={0.5 - i * 0.03} h={0.36} d={0.5 - i * 0.03} color={i % 2 === 0 ? WHITE : '#e8402e'} />
      ))}
      <Voxel x={0} y={2.14} z={0} w={0.56} h={0.05} d={0.56} color="#2b2f36" />
      <Glow x={0} y={2.19} z={0} w={0.26} h={0.22} d={0.26} color="#fff2a8" />
      <group ref={beam} position={[0, 2.3, 0]}>
        <Glow x={0.9} y={-0.03} z={0} w={1.4} h={0.06} d={0.06} color="#fff7c8" />
      </group>
      <Voxel x={0} y={2.41} z={0} w={0.4} h={0.1} d={0.4} color="#e8402e" />
      <Voxel x={0} y={2.51} z={0} w={0.2} h={0.1} d={0.2} color="#e8402e" />
    </group>
  );
};

const BigPalm = ({ position, scale }: { position: Vec3; scale: number }) => (
  <group position={position} scale={scale}>
    <Palm position={[0, 0, 0]} />
  </group>
);

export interface FishingSceneProps {
  rows: number;
}

/** 漁業の島の奥：魚市場・漁村の家・水族館の並ぶ岸壁と灯台（月ビューだけ。塔の町は覆わない） */
export const FishingVillage = ({ rows }: FishingSceneProps) => {
  const back = -rows / 2;
  return (
    <group>
      {/* 曜日の看板（back − 0.55）より奥に置く */}
      <group position={[0, 0, back - 2.45]}>
        <Voxel x={0} y={-0.2} z={0} w={9.2} h={0.7} d={2.6} color="#7e8890" />
        <Voxel x={0} y={0.5} z={0} w={9.24} h={0.04} d={2.64} color={GRASS} />
        <Voxel x={0} y={0.54} z={0.95} w={9.0} h={0.02} d={0.5} color="#d8d2c2" />
        <FishMarket position={[-2.5, 0.54, 0.2]} />
        <House position={[-0.55, 0.54, -0.35]} roof={MARINE} wall={WHITE} scale={1.25} />
        <House position={[0.75, 0.54, 0.1]} roof="#d9662b" wall="#f3e2b6" />
        <Aquarium position={[2.75, 0.54, -0.2]} />
        <BigPalm position={[-3.95, 0.54, -0.6]} scale={2.4} />
        <BigPalm position={[-1.3, 0.54, 0.7]} scale={2.0} />
        <BigPalm position={[1.55, 0.54, -0.8]} scale={2.6} />
        <BigPalm position={[4.25, 0.54, 0.6]} scale={2.2} />
        <LampPost position={[-0.1, 0.54, 0.95]} />
        <LampPost position={[1.9, 0.54, 0.95]} />
      </group>
      <Lighthouse position={[5.2, 0, back - 0.1]} />
    </group>
  );
};

/** 漁業の島のまわり：釣り人の並ぶ桟橋、沖の漁船、跳ねるカジキ、空のマンタ、滝の崖 */
export const FishingGrounds = ({ rows }: FishingSceneProps) => {
  const back = -rows / 2;
  const front = rows / 2;
  return (
    <group>
      <FishingPier rows={rows} />
      <CruisingBoat rows={rows} phase={0} hull="#e8402e" />
      <CruisingBoat rows={rows} phase={Math.PI} hull={MARINE} />
      <LeapingMarlin position={[5.6, 0, front + 0.6]} yaw={0.6} phase={0} />
      <LeapingMarlin position={[-1.5, 0, front + 2.2]} yaw={Math.PI} phase={2.5} />
      <LeapingMarlin position={[6.9, 0, back + 0.4]} yaw={-1.2} phase={1.2} />
      <SkyManta />
      <WaterfallCliff position={[-5.4, 0, back + 0.4]} />
    </group>
  );
};

export interface FishingLandmarkProps {
  /** いちばん高い塔の中心 */
  x: number;
  z: number;
  /** 塔の天面の高さ */
  top: number;
}

/** いちばん高い塔の上で、水しぶきの柱から跳ね上がる巨大マグロ。いつもカメラの方を向く */
export const FishingLandmark = ({ x, z, top }: FishingLandmarkProps) => {
  const tuna = useRef<Group>(null);
  const crown = useRef<Group>(null);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const g = tuna.current;
    if (g) {
      g.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
      g.position.y = top + 1.2 + Math.abs(Math.sin(t * 1.1)) * 0.45;
      g.children[0].rotation.z = 0.45 + Math.sin(t * 2.2) * 0.12;
    }
    if (crown.current) crown.current.rotation.y = t * 0.6;
  });
  return (
    <group>
      <group position={[x, top, z]}>
        <Glow x={0} y={0} z={0} w={0.86} h={0.04} d={0.86} color="#5fd0f5" />
        <Glow x={0} y={0} z={0} w={0.16} h={0.9} d={0.16} color="#bff4ff" />
        <group ref={crown}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <Glow key={i} x={Math.cos(a) * 0.38} y={0.04} z={Math.sin(a) * 0.38} w={0.08} h={0.14 + (i % 2) * 0.12} d={0.08} color="#ffffff" />
            );
          })}
        </group>
      </group>
      <group ref={tuna} position={[x, top + 1.2, z]}>
        <group>
          <mesh geometry={TUNA_GEO} material={FISH_MAT} scale={0.085} />
        </group>
      </group>
    </group>
  );
};
