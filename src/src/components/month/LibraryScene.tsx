import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { type Group, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { UNIT_BOX } from '../models/materials';
import { pixelArtGeometry } from '../models/pixelArt';
import { Voxel } from '../models/Voxel';
import { FloatingIsland } from './LuxurySky';

const LIME = '#ebe6d8';
const LIME_DARK = '#cfc8b4';
const TRIM = '#f7f3ea';
const SLATE = '#3b4a6b';
const SLATE_LIGHT = '#4f6088';
const NAVY = '#2a3f7a';
const GOLD = '#c9a24a';
const WOOD = '#7a5230';
const WOOD_DARK = '#5a3a20';
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

const Glow = ({ x, y, z, w, h, d, color }: BoxProps) => (
  <mesh geometry={UNIT_BOX} material={glowFor(color)} position={[x, y + h / 2, z]} scale={[w, h, d]} />
);

type Vec3 = [number, number, number];

// ---------- 小物 ----------

/** ボクセルの広葉樹 */
const OakTree = ({ position, scale = 1 }: { position: Vec3; scale?: number }) => (
  <group position={position} scale={scale}>
    <Voxel x={0} y={0} z={0} w={0.09} h={0.36} d={0.09} color="#7a4e24" />
    <Voxel x={0} y={0.3} z={0} w={0.5} h={0.34} d={0.5} color="#3e8a2a" />
    <Voxel x={0.04} y={0.6} z={0.02} w={0.36} h={0.2} d={0.36} color="#4caf3a" />
    <Voxel x={-0.2} y={0.42} z={0.12} w={0.18} h={0.16} d={0.18} color="#5fb63b" />
    <Voxel x={0.2} y={0.38} z={-0.14} w={0.16} h={0.16} d={0.16} color="#5fb63b" />
  </group>
);

const LampPost = ({ position }: { position: Vec3 }) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.05} h={0.5} d={0.05} color="#2b2f36" />
    <Voxel x={0} y={0.5} z={0} w={0.12} h={0.03} d={0.12} color="#2b2f36" />
    <Glow x={0} y={0.53} z={0} w={0.09} h={0.1} d={0.09} color="#ffe7a0" />
    <Voxel x={0} y={0.63} z={0} w={0.12} h={0.03} d={0.12} color="#2b2f36" />
  </group>
);

/** 窓の列。lit は灯りの入った閲覧室、そうでなければ青いガラス */
const WindowRow = ({ y, z, xs, h, lit }: { y: number; z: number; xs: number[]; h: number; lit: boolean }) => (
  <>
    {xs.map((x) =>
      lit ? (
        <Glow key={x} x={x} y={y} z={z} w={0.2} h={h} d={0.02} color="#ffd98a" />
      ) : (
        <Voxel key={x} x={x} y={y} z={z} w={0.2} h={h} d={0.02} color="#3b5a86" />
      ),
    )}
  </>
);

/** 青い垂れ幕に金の本 */
const Banner = ({ x, y, z }: { x: number; y: number; z: number }) => (
  <>
    <Voxel x={x} y={y} z={z} w={0.22} h={0.55} d={0.02} color={NAVY} />
    <Voxel x={x} y={y + 0.22} z={z + 0.012} w={0.12} h={0.09} d={0.01} color={GOLD} />
  </>
);

// ---------- 島の奥の建物 ----------

/** 大図書館：石の基壇、柱廊と破風、時計、二段の窓、青いスレートの屋根 */
const GrandLibrary = ({ position }: { position: Vec3 }) => {
  const xs = [-1.6, -1.2, -0.8, 0.8, 1.2, 1.6];
  return (
    <group position={position}>
      <Voxel x={0} y={-0.2} z={0} w={5.4} h={0.7} d={2.8} color={LIME_DARK} />
      <Voxel x={0} y={0.5} z={0} w={5.44} h={0.04} d={2.84} color={GRASS} />
      <Voxel x={0} y={0.5} z={0} w={3.9} h={0.26} d={1.7} color="#bdb6a2" />
      <Voxel x={0} y={0.76} z={0} w={3.8} h={1.64} d={1.6} color={LIME} />
      <WindowRow y={0.95} z={0.81} xs={xs} h={0.42} lit />
      <WindowRow y={1.6} z={0.81} xs={xs} h={0.42} lit={false} />
      {/* 階段 */}
      <Voxel x={0} y={0.5} z={1.25} w={1.5} h={0.08} d={0.3} color={TRIM} />
      <Voxel x={0} y={0.5} z={1.1} w={1.3} h={0.16} d={0.3} color={TRIM} />
      {/* 柱廊 */}
      {[-0.48, -0.16, 0.16, 0.48].map((x) => (
        <Voxel key={x} x={x} y={0.66} z={0.98} w={0.1} h={1.06} d={0.1} color={TRIM} />
      ))}
      <Voxel x={0} y={0.5} z={0.83} w={0.4} h={0.66} d={0.04} color="#a87a3a" />
      <Glow x={0} y={1.06} z={0.86} w={0.3} h={0.08} d={0.01} color="#ffd98a" />
      <Voxel x={0} y={1.72} z={0.95} w={1.36} h={0.14} d={0.32} color={TRIM} />
      <Voxel x={0} y={1.86} z={0.95} w={1.1} h={0.12} d={0.3} color={LIME} />
      <Voxel x={0} y={1.98} z={0.95} w={0.72} h={0.12} d={0.3} color={LIME} />
      <Voxel x={0} y={2.1} z={0.95} w={0.32} h={0.1} d={0.3} color={LIME} />
      <Banner x={-0.95} y={1.0} z={0.82} />
      <Banner x={0.95} y={1.0} z={0.82} />
      {/* 屋根 */}
      <Voxel x={0} y={2.4} z={0} w={4.1} h={0.22} d={1.9} color={SLATE} />
      <Voxel x={0} y={2.62} z={0} w={3.5} h={0.22} d={1.5} color={SLATE_LIGHT} />
      <Voxel x={0} y={2.84} z={0} w={2.7} h={0.22} d={1.1} color={SLATE} />
      <Voxel x={0} y={3.06} z={0} w={1.7} h={0.18} d={0.6} color={SLATE_LIGHT} />
      {/* 時計のある切妻 */}
      <Voxel x={0} y={2.4} z={0.62} w={1.1} h={1.0} d={0.5} color={LIME} />
      <Voxel x={0} y={3.4} z={0.62} w={1.24} h={0.12} d={0.62} color={SLATE} />
      <Voxel x={0} y={3.52} z={0.62} w={0.8} h={0.12} d={0.46} color={SLATE_LIGHT} />
      <Voxel x={0} y={2.62} z={0.88} w={0.56} h={0.56} d={0.03} color={GOLD} />
      <Voxel x={0} y={2.66} z={0.9} w={0.46} h={0.46} d={0.02} color="#fffaf0" />
      <Voxel x={0} y={2.88} z={0.915} w={0.035} h={0.18} d={0.01} color="#1b2a41" />
      <Voxel x={0.06} y={2.88} z={0.915} w={0.13} h={0.035} d={0.01} color="#1b2a41" />
      <OakTree position={[-2.25, 0.54, 0.75]} scale={1.3} />
      <OakTree position={[2.3, 0.54, 0.7]} scale={1.25} />
      <OakTree position={[-2.35, 0.54, -0.8]} scale={1.1} />
      <OakTree position={[2.35, 0.54, -0.85]} scale={1.15} />
      <LampPost position={[-0.85, 0.54, 1.25]} />
      <LampPost position={[0.85, 0.54, 1.25]} />
    </group>
  );
};

/** 3×5 の文字（LIBRARY 用） */
const LETTERS: Record<string, string[]> = {
  L: ['#..', '#..', '#..', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
};

const SIGN_ROWS: string[] = (() => {
  const word = 'LIBRARY';
  const width = word.length * 4 + 1;
  const grid: string[][] = Array.from({ length: 7 }, () => Array.from({ length: width }, () => 'p'));
  [...word].forEach((c, i) => {
    LETTERS[c].forEach((line, dy) => {
      [...line].forEach((ch, dx) => {
        if (ch === '#') grid[1 + dy][1 + i * 4 + dx] = 'k';
      });
    });
  });
  return grid.map((row) => row.join(''));
})();

/** 開いた本の紋章（ページが反った見開きの影） */
const EMBLEM_ROWS = [
  'ww.......ww',
  'wwww...wwww',
  'wwwwwkwwwww',
  'kwwwwkwwwwk',
  '.kkwwkwwkk.',
  '...kkkkk...',
];

const SIGN_MAT = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const SIGN_GEO = pixelArtGeometry(SIGN_ROWS, { p: '#e9dcbc', k: '#3a2a18' }, 1);
const EMBLEM_GEO = pixelArtGeometry(EMBLEM_ROWS, { k: '#3a2a18', w: '#fff6dc' }, 1);

/** LIBRARY の塔：下はグレーの石、上は石灰岩、看板と本の紋章、青い尖塔 */
const LibraryTower = ({ position }: { position: Vec3 }) => (
  <group position={position}>
    <Voxel x={0} y={-0.2} z={0} w={1.4} h={1.7} d={1.4} color="#9ba0a7" />
    <Voxel x={0} y={1.5} z={0} w={1.25} h={3.3} d={1.25} color={LIME} />
    {[2.0, 2.6, 3.2].map((y) => (
      <WindowRow key={y} y={y} z={0.63} xs={[-0.32, 0, 0.32]} h={0.36} lit={y === 2.0} />
    ))}
    <mesh geometry={SIGN_GEO} material={SIGN_MAT} position={[0, 4.15, 0.64]} scale={0.036} />
    <Voxel x={0} y={0.4} z={0.7} w={0.95} h={0.65} d={0.02} color={NAVY} />
    <mesh geometry={EMBLEM_GEO} material={SIGN_MAT} position={[0, 0.72, 0.72]} scale={0.075} />
    <Voxel x={0} y={4.8} z={0} w={1.37} h={0.12} d={1.37} color={LIME_DARK} />
    <Voxel x={0} y={4.92} z={0} w={1.1} h={0.25} d={1.1} color={SLATE} />
    <Voxel x={0} y={5.17} z={0} w={0.72} h={0.25} d={0.72} color={SLATE_LIGHT} />
    <Voxel x={0} y={5.42} z={0} w={0.06} h={0.38} d={0.06} color={GOLD} />
    <Voxel x={0} y={5.66} z={0} w={0.2} h={0.05} d={0.05} color={GOLD} />
    <OakTree position={[-0.95, 0, 0.5]} scale={1.2} />
  </group>
);

/** 西棟：灯りのともる閲覧室と青い屋根 */
const WestHall = ({ position }: { position: Vec3 }) => (
  <group position={position}>
    <Voxel x={0} y={-0.2} z={0} w={2.3} h={0.7} d={1.7} color={LIME_DARK} />
    <Voxel x={0} y={0.5} z={0} w={2.34} h={0.04} d={1.74} color={GRASS} />
    <Voxel x={0} y={0.54} z={-0.05} w={1.8} h={1.0} d={1.2} color={LIME} />
    <WindowRow y={0.75} z={0.56} xs={[-0.6, -0.3, 0, 0.3, 0.6]} h={0.5} lit />
    <Banner x={-0.82} y={0.85} z={0.56} />
    <Voxel x={0} y={1.54} z={-0.05} w={2.0} h={0.2} d={1.4} color={SLATE} />
    <Voxel x={0} y={1.74} z={-0.05} w={1.5} h={0.2} d={1.0} color={SLATE_LIGHT} />
    <OakTree position={[0.95, 0.54, 0.55]} scale={1.1} />
    <LampPost position={[-1.0, 0.54, 0.65]} />
  </group>
);

// ---------- 島の外の海 ----------

/** 台座の上の巨大な開いた本。右から左へ 1 枚ずつページがめくれる */
const GiantBook = ({ position }: { position: Vec3 }) => {
  const page = useRef<Group>(null);
  useFrame(({ clock }) => {
    const p = page.current;
    if (!p) return;
    const k = (clock.elapsedTime / 4) % 1;
    p.rotation.z = k < 0.7 ? (k / 0.7) * Math.PI : Math.PI;
  });
  const lines = [-0.25, -0.12, 0.01, 0.14, 0.27];
  const half = (side: -1 | 1) => (
    <group position={[side * 0.36, 0, 0]} rotation={[0, 0, side * -0.16]}>
      <Voxel x={0} y={0} z={0} w={0.74} h={0.06} d={1.0} color="#5a2e1e" />
      <Voxel x={0} y={0.06} z={0} w={0.68} h={0.12} d={0.92} color="#fff6dc" />
      {lines.map((z) => (
        <Voxel key={z} x={0} y={0.18} z={z} w={0.5} h={0.005} d={0.03} color="#8a8172" />
      ))}
    </group>
  );
  return (
    <group position={position} rotation={[0, 0.35, 0]}>
      <Voxel x={0} y={-0.1} z={0} w={1.7} h={0.3} d={1.3} color={WOOD_DARK} />
      <Voxel x={0} y={0.2} z={0} w={1.5} h={0.18} d={1.15} color={WOOD} />
      <group position={[0, 0.5, 0]} rotation={[-0.35, 0, 0]}>
        {half(-1)}
        {half(1)}
        <group ref={page} position={[0, 0.19, 0]}>
          <Voxel x={0.33} y={0} z={0} w={0.64} h={0.01} d={0.9} color="#fffaf0" />
        </group>
      </group>
    </group>
  );
};

/** 机で本を読む学生（紺の制服） */
const Student = ({ position, rotation }: { position: Vec3; rotation: number }) => (
  <group position={position} rotation={[0, rotation, 0]}>
    <Voxel x={0} y={0} z={0} w={0.12} h={0.12} d={0.12} color={WOOD_DARK} />
    <Voxel x={0} y={0.12} z={0} w={0.13} h={0.17} d={0.1} color="#24305e" />
    <Voxel x={0} y={0.29} z={0} w={0.1} h={0.1} d={0.1} color="#f0a878" />
    <Voxel x={0} y={0.37} z={-0.01} w={0.11} h={0.04} d={0.11} color="#2b1b10" />
  </group>
);

const ReadingTable = ({ position }: { position: Vec3 }) => (
  <group position={position}>
    <Voxel x={0} y={0} z={0} w={0.04} h={0.2} d={0.04} color={WOOD_DARK} />
    <Voxel x={0} y={0.2} z={0} w={0.5} h={0.04} d={0.32} color={WOOD} />
    <Voxel x={-0.1} y={0.24} z={0} w={0.12} h={0.01} d={0.09} color="#fff6dc" />
    <Voxel x={0.12} y={0.24} z={0.02} w={0.1} h={0.03} d={0.08} color="#2e5aa8" />
    <Student position={[0, 0, 0.26]} rotation={Math.PI} />
    <Student position={[0, 0, -0.26]} rotation={0} />
  </group>
);

/** 噴水と読書机のある広場の浮き台 */
const ReadingPlaza = ({ position }: { position: Vec3 }) => {
  const jet = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (jet.current) jet.current.scale.y = 0.8 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.4;
  });
  return (
    <group position={position} rotation={[0, -0.3, 0]}>
      <Voxel x={0} y={-0.2} z={0} w={2.1} h={0.42} d={1.8} color={LIME_DARK} />
      <Voxel x={0} y={0.22} z={0} w={2.12} h={0.03} d={1.82} color={GRASS} />
      <Voxel x={0} y={0.25} z={0} w={1.7} h={0.02} d={1.4} color="#e6e0d0" />
      <Voxel x={0} y={0.27} z={-0.25} w={0.8} h={0.12} d={0.8} color={TRIM} />
      <Voxel x={0} y={0.3} z={-0.25} w={0.66} h={0.1} d={0.66} color="#4fc3f7" />
      <Voxel x={0} y={0.27} z={-0.25} w={0.12} h={0.4} d={0.12} color={TRIM} />
      <Voxel x={0} y={0.67} z={-0.25} w={0.34} h={0.05} d={0.34} color={TRIM} />
      <group ref={jet} position={[0, 0.72, -0.25]}>
        <Voxel x={0} y={0} z={0} w={0.06} h={0.25} d={0.06} color="#bfefff" />
      </group>
      <ReadingTable position={[-0.5, 0.27, 0.45]} />
      <ReadingTable position={[0.5, 0.27, 0.45]} />
      <LampPost position={[-0.9, 0.27, -0.75]} />
      <LampPost position={[0.9, 0.27, -0.75]} />
      <OakTree position={[-0.8, 0.27, -0.2]} />
      <OakTree position={[0.82, 0.27, -0.15]} scale={0.9} />
    </group>
  );
};

/** 苔むした崖と、海へ落ちる滝。しぶきが流れ落ちる */
const WaterfallCliff = ({ position }: { position: Vec3 }) => {
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

/** 空の天文台（白いドームと望遠鏡） */
const Observatory = () => (
  <group>
    <Voxel x={0} y={0} z={0} w={0.6} h={0.36} d={0.6} color={TRIM} />
    <Voxel x={0} y={0.36} z={0} w={0.56} h={0.12} d={0.56} color="#dfe6ee" />
    <Voxel x={0} y={0.48} z={0} w={0.42} h={0.12} d={0.42} color="#dfe6ee" />
    <Voxel x={0} y={0.6} z={0} w={0.24} h={0.08} d={0.24} color="#dfe6ee" />
    <group position={[0.12, 0.6, 0.05]} rotation={[0, 0, 0.7]}>
      <Voxel x={0} y={0} z={0} w={0.06} h={0.3} d={0.06} color="#2b2f36" />
    </group>
  </group>
);

const SKY_ISLANDS: { position: Vec3; scale: number; phase: number; top: 'trees' | 'observatory' }[] = [
  { position: [-9.8, 2.6, -2.5], scale: 1.3, phase: 0, top: 'trees' },
  { position: [10.2, 3.2, -3.5], scale: 1.2, phase: 1.7, top: 'trees' },
  { position: [-6.8, 5.2, -11.5], scale: 1.6, phase: 3.1, top: 'observatory' },
  { position: [7.8, 5.8, -12.5], scale: 1.5, phase: 4.4, top: 'trees' },
];

export interface LibrarySceneProps {
  rows: number;
}

/** 知識の島：島の奥の大図書館、LIBRARY の塔、西棟（月ビューだけ。塔の町は覆わない） */
export const LibraryScene = ({ rows }: LibrarySceneProps) => {
  const back = -rows / 2;
  return (
    <group>
      <GrandLibrary position={[0, 0, back - 2.6]} />
      <LibraryTower position={[3.7, 0, back - 1.6]} />
      <WestHall position={[-3.6, 0, back - 1.7]} />
    </group>
  );
};

/** 知識の島のまわり：巨大な本、読書の広場、滝の崖、木と天文台の浮島 */
export const LibraryGrounds = ({ rows }: LibrarySceneProps) => {
  const back = -rows / 2;
  const front = rows / 2;
  return (
    <group>
      <GiantBook position={[-4.8, 0, front - 0.4]} />
      <ReadingPlaza position={[4.7, 0, front - 0.1]} />
      <WaterfallCliff position={[-5.4, 0, back + 0.9]} />
      {SKY_ISLANDS.map(({ position, scale, phase, top }) => (
        <FloatingIsland key={`${position[0]}-${position[2]}`} position={position} scale={scale} phase={phase}>
          {top === 'observatory' ? (
            <Observatory />
          ) : (
            <>
              <OakTree position={[-0.35, 0, -0.1]} scale={1.4} />
              <OakTree position={[0.4, 0, 0.2]} scale={1.1} />
            </>
          )}
        </FloatingIsland>
      ))}
    </group>
  );
};
