import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import { pixelArtGeometry, Voxel } from '@plugin-sdk';

// ---------- ドット絵 ----------

const SKIN = {
  s: '#f0a878',
  S: '#c87850',
  m: '#7a2e1e',
  e: '#2b1b10',
  w: '#ffffff',
  k: '#22201f',
};

/** 中央：ダブルバイセップス。g はサングラス、b は青いパンツ */
const CENTER_ROWS = [
  '..sss......kkkkkk......sss..',
  '.sssss....kkkkkkkk....sssss.',
  '.sssss....kssssssk....sssss.',
  '.SssSs....sggSSggs....sSssS.',
  '..sss.....ssssssss.....sss..',
  '..sss.....sssmmsss.....sss..',
  '..ssss.....ssssss.....ssss..',
  '..sssss.....SssS.....sssss..',
  '..ssssss..ssssssss..ssssss..',
  '...ssssssssssssssssssssss...',
  '....sssssssSssssSsssssss....',
  '.....ssssssSssssSssssss.....',
  '........sssSssssSsss........',
  '........ssSssSSssSss........',
  '.........sSsSssSsSs.........',
  '.........ssSssssSss.........',
  '..........sSsSSsSs..........',
  '.........bbbbbbbbbb.........',
  '.........bbbwbbwbbb.........',
  '.........bbbbbbbbbb.........',
  '.........ssss..ssss.........',
  '........sSsss..sssSs........',
  '........sssss..sssss........',
  '........ssSss..ssSss........',
  '.........sss....sss.........',
  '.........sss....sss.........',
  '........kkkk....kkkk........',
];

/** 左：金髪、黒いタンクトップ。上げた腕は LEFT_ARM で別に動かす */
const LEFT_ROWS = [
  '......yyyyyy......',
  '.....yyyyyyyy.....',
  '.....yssssssy.....',
  '.....sesssses.....',
  '.....ssssssss.....',
  '.....ssSmmSss.....',
  '......ssssss......',
  '.......SssS.......',
  '....sttssssttss...',
  '....ttttttttttsss.',
  '.....tttttttttsss.',
  '.....ttttttttt.sss',
  '.....ttttttttt.sss',
  '.....ttttttttt..ss',
  '.....ttttttttt..ss',
  '.....bbbbbbbbb..ss',
  '.....bbbbbbbbb..kk',
  '.....bbbbwbbbb....',
  '.....ssss.ssss....',
  '.....sSss.sSss....',
  '.....ssss.ssss....',
  '.....ssss.ssss....',
  '.....wwww.wwww....',
  '....kkkkk.kkkkk...',
];

/** 左の人の上げた腕とダンベル。下端の中央が肩 */
const LEFT_ARM_ROWS = [
  'dd.......dd',
  'dd.......dd',
  'ddggggggggd',
  'dd...ss..dd',
  'dd...ss..dd',
  '.....ss....',
  '....sss....',
  '....ssss...',
  '....ssss...',
  '.....ss....',
];

/** 右：赤いハチマキ、黒いタンクトップ。バーベルと前腕は BARBELL で上下させる */
const RIGHT_ROWS = [
  '......kkkkkkkk......',
  '......rrrrrrrr......',
  '......ssssssss......',
  '......seessees......',
  '......ssssssss......',
  '......ssmmmmss......',
  '.......ssssss.......',
  '........SssS........',
  '..ssssttssssttssss..',
  '..sssttttttttttsss..',
  '..ss.tttttttttt.ss..',
  '.....tttttttttt.....',
  '.....tttttttttt.....',
  '.....tttttttttt.....',
  '.....rrrrrrrrrr.....',
  '.....rrrrwwrrrr.....',
  '.....sssss.ssss.....',
  '.....sSsss.sssS.....',
  '.....sssss.ssss.....',
  '.....sssss.ssss.....',
  '.....wwwww.wwww.....',
  '....kkkkkk.kkkkk....',
];

const BARBELL_ROWS = [
  'pp..........................pp',
  'PPpp......................ppPP',
  'PPppggggggggggggggggggggggppPP',
  'PPpp....ss..........ss....ppPP',
  'pp......ss..........ss......pp',
  '........ss..........ss........',
  '........ss..........ss........',
  '........ss..........ss........',
];

const WEIGHTS = { d: '#1c1d22', p: '#26272d', P: '#3a3c44', g: '#b8bec8' };

/** 3×5 の文字（PROTEIN 用） */
const LETTERS: Record<string, string[]> = {
  P: ['###', '#.#', '###', '#..', '#..'],
  R: ['###', '#.#', '##.', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
};

/** 黄色の看板。黒い縁、PROTEIN の文字、下にダンベル */
const SIGN_ROWS: string[] = (() => {
  const word = 'PROTEIN';
  const textWidth = [...word].reduce((w, c) => w + LETTERS[c][0].length, 0) + word.length - 1;
  const width = textWidth + 6;
  const height = 14;
  const grid: string[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 'k' : 'y')),
  );
  let x0 = 3;
  for (const c of word) {
    LETTERS[c].forEach((line, dy) => {
      [...line].forEach((ch, dx) => {
        if (ch === '#') grid[2 + dy][x0 + dx] = 'k';
      });
    });
    x0 += LETTERS[c][0].length + 1;
  }
  const mid = Math.floor(width / 2);
  for (let x = mid - 6; x <= mid + 6; x++) grid[10][x] = 'g';
  for (const px of [mid - 7, mid - 6, mid + 6, mid + 7]) {
    for (let y = 8; y <= 12; y++) grid[y][px] = 'd';
  }
  return grid.map((row) => row.join(''));
})();

/** プロテインのシェイカー。白いマッチョの腕のロゴ */
const SHAKER_ROWS = [
  '...kkkkkkkk...',
  '..kkkkkkkkkk..',
  '..kKKKKKKKKk..',
  '.gggggggggggg.',
  'gghggggggggggg',
  'gghggggggggggg',
  'gghggggggggggg',
  'gghgggwwgggggg',
  'gghggwwwwggggg',
  'gghgggwwwggwgg',
  'gghggggwwwgwwg',
  'gghggggwwwwwwg',
  'gghgggggwwwwgg',
  'gghggggggggggg',
  'gghggggggggggg',
  'gghggggggggggg',
  'gghggggggggggg',
  'gghggggggggggg',
  '.gggggggggggg.',
  '..gggggggggg..',
];

const solid = (emissive: number) =>
  new MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.05, emissive: '#ffffff', emissiveIntensity: emissive });

const CENTER_GEO = pixelArtGeometry(CENTER_ROWS, { ...SKIN, g: '#111111', b: '#2a52be' }, 6);
const LEFT_GEO = pixelArtGeometry(LEFT_ROWS, { ...SKIN, y: '#f2c94c', t: '#1d1d22', b: '#2a52be' }, 5);
const LEFT_ARM_GEO = pixelArtGeometry(LEFT_ARM_ROWS, { ...SKIN, ...WEIGHTS }, 5);
const RIGHT_GEO = pixelArtGeometry(RIGHT_ROWS, { ...SKIN, r: '#d8322a', t: '#1d1d22' }, 5);
const BARBELL_GEO = pixelArtGeometry(BARBELL_ROWS, { ...SKIN, ...WEIGHTS }, 5);
const SIGN_GEO = pixelArtGeometry(SIGN_ROWS, { y: '#ffd23a', k: '#1b1b1f', g: '#5a5f68', d: '#1b1b1f' }, 2);
const SHAKER_GEO = pixelArtGeometry(
  SHAKER_ROWS,
  { k: '#15171c', K: '#2a2d33', g: '#2b2f36', h: '#4a505a', w: '#f4f4f4' },
  12,
);
const BODY_MAT = solid(0.06);
const SIGN_MAT = solid(0.12);

// ---------- 後光 ----------

const RAYS_TEXTURE = (() => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('MuscleScene: 2D コンテキストが取れません');
  }
  const c = size / 2;
  for (let k = 0; k < 18; k++) {
    const a0 = (k / 18) * Math.PI * 2;
    const a1 = a0 + Math.PI / 30;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,248,210,0.9)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5);
  glow.addColorStop(0, 'rgba(255,255,240,0.9)');
  glow.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
})();

const RAYS_MAT = new MeshBasicMaterial({
  map: RAYS_TEXTURE,
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
  toneMapped: false,
});

// ---------- 部品 ----------

/** 常にカメラの方を向く（平たいドット絵が真横を向いて消えないように） */
const FaceCamera = ({ position, children }: { position: [number, number, number]; children: ReactNode }) => {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y = Math.atan2(camera.position.x - position[0], camera.position.z - position[2]);
  });
  return (
    <group ref={group} position={position}>
      {children}
    </group>
  );
};

/** 海から立つ石の台座 */
const Plinth = ({ w, h }: { w: number; h: number }) => (
  <>
    <Voxel x={0} y={-0.2} z={0} w={w} h={h + 0.2} d={w * 0.6} color="#8c929b" />
    <Voxel x={0} y={h} z={0} w={w + 0.1} h={0.08} d={w * 0.6 + 0.1} color="#f2d77a" />
  </>
);

interface FigureProps {
  position: [number, number, number];
  /** 1 ピクセルの大きさ */
  pixel: number;
}

const CenterFigure = ({ position, pixel }: FigureProps) => {
  const body = useRef<Mesh>(null);
  const height = CENTER_ROWS.length * pixel;
  useFrame(({ clock }) => {
    const m = body.current;
    if (!m) return;
    const flex = Math.max(0, Math.sin(clock.elapsedTime * 2.4));
    m.scale.set(pixel * (1 + flex * 0.04), pixel * (1 + flex * 0.015), pixel);
  });
  return (
    <FaceCamera position={position}>
      <mesh material={RAYS_MAT} position={[0, 0.5 + height * 0.62, -0.8]}>
        <planeGeometry args={[height * 1.6, height * 1.6]} />
      </mesh>
      <Plinth w={1.7} h={0.5} />
      <mesh ref={body} geometry={CENTER_GEO} material={BODY_MAT} position={[0, 0.58 + height / 2, 0]} scale={pixel} />
    </FaceCamera>
  );
};

const RaysSpin = () => {
  useFrame(({ clock }) => {
    RAYS_TEXTURE.rotation = clock.elapsedTime * 0.08;
    RAYS_TEXTURE.center.set(0.5, 0.5);
  });
  return null;
};

const LeftFigure = ({ position, pixel }: FigureProps) => {
  const arm = useRef<Group>(null);
  const height = LEFT_ROWS.length * pixel;
  const base = 0.58 + height / 2;
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.z = -0.15 + Math.sin(clock.elapsedTime * 2.2) * 0.35;
  });
  return (
    <FaceCamera position={position}>
      <Plinth w={1.2} h={0.5} />
      <mesh geometry={LEFT_GEO} material={BODY_MAT} position={[0, base, 0]} scale={pixel} />
      {/* 肩（4 列目・8 行目の上端）を中心に腕を振る */}
      <group ref={arm} position={[-4.5 * pixel, base + 4 * pixel, 0]}>
        <mesh geometry={LEFT_ARM_GEO} material={BODY_MAT} position={[0, 5 * pixel, 0]} scale={pixel} />
      </group>
    </FaceCamera>
  );
};

const RightFigure = ({ position, pixel }: FigureProps) => {
  const bar = useRef<Mesh>(null);
  const height = RIGHT_ROWS.length * pixel;
  const base = 0.58 + height / 2;
  const shoulderTop = base + 3 * pixel;
  useFrame(({ clock }) => {
    if (bar.current) bar.current.position.y = shoulderTop + 4 * pixel + Math.abs(Math.sin(clock.elapsedTime * 1.8)) * 2.5 * pixel;
  });
  return (
    <FaceCamera position={position}>
      <Plinth w={1.2} h={0.5} />
      <mesh geometry={RIGHT_GEO} material={BODY_MAT} position={[0, base, 0]} scale={pixel} />
      <mesh ref={bar} geometry={BARBELL_GEO} material={BODY_MAT} position={[0, shoulderTop + 4 * pixel, 0]} scale={pixel} />
    </FaceCamera>
  );
};

const ProteinSign = ({ position }: { position: [number, number, number] }) => {
  const pixel = 0.075;
  const width = SIGN_ROWS[0].length * pixel;
  const height = SIGN_ROWS.length * pixel;
  return (
    <FaceCamera position={position}>
      <Voxel x={-width * 0.3} y={0} z={-0.05} w={0.08} h={1.3} d={0.08} color="#5a5f68" />
      <Voxel x={width * 0.3} y={0} z={-0.05} w={0.08} h={1.3} d={0.08} color="#5a5f68" />
      <mesh geometry={SIGN_GEO} material={SIGN_MAT} position={[0, 1.3 + height / 2, 0]} scale={pixel} />
    </FaceCamera>
  );
};

const Shaker = ({ position }: { position: [number, number, number] }) => {
  const pixel = 0.1;
  const height = SHAKER_ROWS.length * pixel;
  return (
    <FaceCamera position={position}>
      <Plinth w={1.2} h={0.3} />
      <mesh geometry={SHAKER_GEO} material={BODY_MAT} position={[0, 0.38 + height / 2, 0]} scale={pixel} />
    </FaceCamera>
  );
};

export interface MuscleSceneProps {
  /** 月グリッドの行数（島の奥行き） */
  rows: number;
}

/**
 * マッチョの島：島の奥の海に立つ 3 人の巨大なボディビルダー（ポーズ・ダンベル・バーベル）、
 * 後光、左手前の PROTEIN 看板、右奥のシェイカー。どれも町の外に置き、予定の塔は覆わない。
 */
export const MuscleScene = ({ rows }: MuscleSceneProps) => {
  const back = -rows / 2;
  const front = rows / 2;
  const positions = useMemo(
    () => ({
      center: [0, 0, back - 3] as [number, number, number],
      left: [-3.7, 0, back - 2.2] as [number, number, number],
      right: [3.7, 0, back - 2.4] as [number, number, number],
      sign: [-4.7, 0, front - 0.6] as [number, number, number],
      shaker: [5.2, 0, back - 0.6] as [number, number, number],
    }),
    [back, front],
  );
  return (
    <group>
      <RaysSpin />
      <CenterFigure position={positions.center} pixel={0.18} />
      <LeftFigure position={positions.left} pixel={0.13} />
      <RightFigure position={positions.right} pixel={0.13} />
      <ProteinSign position={positions.sign} />
      <Shaker position={positions.shaker} />
    </group>
  );
};
