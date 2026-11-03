import { useEffect, useState, type ReactElement } from 'react';
import './TravelLoading.css';

export interface TravelLoadingProps {
  /** travel = 友達の島へ移動（飛行機）。build = ログイン直後、自分の島が出来上がる */
  variant: 'travel' | 'build';
  /** 行き先の名前。見出しは travel なら「{name} の島へ」、build なら「{name} の島」 */
  name: string;
  /** false になったらフェードアウト（0.4s）。親はフェード後にアンマウントする */
  visible: boolean;
}

const INK = '#1b2a41';
const GRASS = '#5fb63b';
const GRASS_LIGHT = '#7fd05a';
const DIRT = '#8b5a2b';
const DIRT_DARK = '#6f4521';
const SAND = '#e8d49a';
const STONE = '#9a9a9a';
const SEA = '#3b8fd8';
const SEA_DEEP = '#2e74b8';
const FOAM = '#cfeeff';
const CLOUD = '#ffffff';
const CLOUD_SHADE = '#dff0ff';

/* ---------- ピクセルの飛行機（16×16。白い機体・青の翼・後ろにハートの旗） ---------- */

const PLANE_ROWS = [
  '................',
  '.r.r............',
  'rrrrr.kk........',
  '.rrrkkkwk.......',
  '..r...kwwk......',
  '...kkkkwwwkkkkk.',
  '..kwwwwwwwwwwwwk',
  '..kwwkwkwkwwwwwk',
  '...kwwwwwwwwwwk.',
  '....kkkbbbbkkk..',
  '......kbbbbk....',
  '.......kbbk.....',
  '........kk......',
  '................',
  '................',
  '................',
] as const;

const PLANE_PALETTE: Record<string, string> = { k: INK, w: '#ffffff', b: '#2e86de', r: '#ff2e88' };

/** 横に続く同色のピクセルを 1 本の rect にまとめる（icons/index.tsx の PixelArt と同じ考え方） */
const rowsToRects = (rows: readonly string[], palette: Record<string, string>): ReactElement[] => {
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x += 1;
        continue;
      }
      const fill = palette[ch];
      if (fill === undefined) {
        throw new Error(`TravelLoading: palette に "${ch}" がありません（${y} 行目）`);
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={fill} />);
      x = end;
    }
  });
  return rects;
};

const PLANE_RECTS = rowsToRects(PLANE_ROWS, PLANE_PALETTE);

/* ---------- 背景：空・雲・島の横顔・海（viewBox 320×180、ピクセル単位 = 2） ---------- */

const BG_W = 320;
const BG_H = 180;
const HORIZON_Y = 118;
const PX = 2;

/** ピクセル座標で rect を置く */
const px = (x: number, y: number, w: number, h: number, fill: string, key: string) => (
  <rect key={key} x={x * PX} y={y * PX} width={w * PX} height={h * PX} fill={fill} />
);

/** ピクセル雲：中央の塊と左右の出っ張り */
const cloud = (x: number, y: number, key: string): ReactElement[] => [
  px(x + 3, y, 8, 1, CLOUD, `${key}-a`),
  px(x + 1, y + 1, 13, 1, CLOUD, `${key}-b`),
  px(x, y + 2, 16, 1, CLOUD, `${key}-c`),
  px(x + 1, y + 3, 14, 1, CLOUD_SHADE, `${key}-d`),
];

interface IslandSpec {
  /** 島の左端（ピクセル） */
  x: number;
  /** 島の幅（ピクセル） */
  w: number;
  /** 塔の [左端オフセット, 幅, 高さ] の並び */
  towers: [number, number, number][];
}

/** 遠くの島の横顔：砂浜の上に土の層、草の天面、その上に四角い塔のシルエット */
const island = ({ x, w, towers }: IslandSpec, key: string): ReactElement[] => {
  const y = HORIZON_Y / PX;
  const parts: ReactElement[] = [
    px(x - 3, y - 1, w + 6, 1, SAND, `${key}-sand`),
    px(x - 1, y - 4, w + 2, 3, DIRT, `${key}-dirt`),
    px(x, y - 5, w, 1, DIRT_DARK, `${key}-dirt-top`),
    px(x, y - 7, w, 2, GRASS, `${key}-grass`),
    px(x + 1, y - 8, w - 2, 1, GRASS_LIGHT, `${key}-grass-top`),
  ];
  towers.forEach(([ox, tw, th], i) => {
    const top = y - 8 - th;
    parts.push(
      px(x + ox, top, tw, th, STONE, `${key}-tower-${i}`),
      px(x + ox, top, tw, 1, GRASS_LIGHT, `${key}-tower-${i}-cap`),
      px(x + ox + tw - 1, top + 1, 1, th - 1, '#6e6e6e', `${key}-tower-${i}-shade`),
    );
  });
  return parts;
};

const ISLANDS: IslandSpec[] = [
  { x: 22, w: 40, towers: [[4, 5, 6], [12, 7, 11], [22, 5, 4], [30, 6, 8]] },
  { x: 104, w: 34, towers: [[3, 6, 9], [13, 5, 5], [22, 8, 13]] },
];

/** 波の 1 周期（ピクセル）。この幅ぶん左へ流して繰り返す */
const WAVE_PERIOD = 12;

/** 横一列の波。山（泡）と谷（濃い海）を周期で並べ、画面幅 + 1 周期ぶん描く */
const waveRow = (y: number, key: string): ReactElement[] => {
  const parts: ReactElement[] = [];
  const count = Math.ceil(BG_W / PX / WAVE_PERIOD) + 1;
  for (let i = 0; i < count; i += 1) {
    const x = i * WAVE_PERIOD;
    parts.push(
      px(x, y, 4, 1, FOAM, `${key}-${i}-foam`),
      px(x + 4, y + 1, 3, 1, FOAM, `${key}-${i}-foam2`),
      px(x + 7, y + 1, 5, 1, SEA_DEEP, `${key}-${i}-deep`),
    );
  }
  return parts;
};

const CLOUDS = [...cloud(18, 14, 'c1'), ...cloud(92, 30, 'c2'), ...cloud(128, 8, 'c3')];
/** build 用の雲：中央の島（x 47〜113）と塔に重ならない位置 */
const BUILD_CLOUDS = [...cloud(14, 30, 'b1'), ...cloud(70, 6, 'b2'), ...cloud(124, 36, 'b3')];
const ISLAND_RECTS = ISLANDS.flatMap((spec, i) => island(spec, `i${i}`));
const WAVE_FRONT = waveRow(HORIZON_Y / PX + 10, 'wf');
const WAVE_BACK = waveRow(HORIZON_Y / PX + 3, 'wb');

/* ---------- build：中央の島が下から順に組み上がる（背景 SVG と同じピクセル座標） ---------- */

/** 組み上がりの 1 周期（秒）。完成（約 2.4s）のあと 0.6s 止めて、島を作り直す */
const BUILD_LOOP_SEC = 3.0;

/** ブロック 1 段の高さ（ピクセル） */
const BLOCK_H = 2;

interface BuildTowerSpec {
  /** 島の左端からのオフセット（ピクセル） */
  ox: number;
  /** 幅（ピクセル） */
  w: number;
  /** 段数 */
  blocks: number;
  /** 屋上の小さな建物の色 */
  roof: string;
}

const BUILD_ISLAND_X = 52;
const BUILD_ISLAND_W = 56;
const BUILD_TOWERS: BuildTowerSpec[] = [
  { ox: 3, w: 8, blocks: 5, roof: '#ffc83d' },
  { ox: 15, w: 10, blocks: 8, roof: '#ff2e88' },
  { ox: 29, w: 7, blocks: 4, roof: '#19c2ff' },
  { ox: 40, w: 10, blocks: 6, roof: '#7dff5a' },
];

/** 出現タイミング（秒）。地面の層 → 塔の段 → 屋上の順に並べる */
const T_SAND = 0;
const T_DIRT = 0.25;
const T_DIRT_TOP = 0.45;
const T_GRASS = 0.6;
const T_GRASS_TOP = 0.75;
const T_TOWER_START = 0.95;
/** 同じ段どうしの間隔。塔ごとに少しずらして「積んでいる」感じにする */
const T_BLOCK_STEP = 0.12;
const T_TOWER_STAGGER = 0.03;
const T_ROOF_START = 2.0;
const T_ROOF_STEP = 0.08;

/** 遅延付きで現れる部品。アニメーションは CSS（.travel-build-part） */
const buildPart = (delaySec: number, key: string, children: ReactElement[]) => (
  <g key={key} className="travel-build-part" style={{ animationDelay: `${delaySec}s` }}>
    {children}
  </g>
);

const buildIsland = (): ReactElement[] => {
  const x = BUILD_ISLAND_X;
  const w = BUILD_ISLAND_W;
  const y = HORIZON_Y / PX;
  const parts: ReactElement[] = [
    buildPart(T_SAND, 'sand', [px(x - 5, y - 2, w + 10, 2, SAND, 'sand')]),
    buildPart(T_DIRT, 'dirt', [
      px(x - 2, y - 8, w + 4, 6, DIRT, 'dirt'),
      px(x - 2, y - 6, 1, 4, DIRT_DARK, 'dirt-l'),
      px(x + w + 1, y - 6, 1, 4, DIRT_DARK, 'dirt-r'),
    ]),
    buildPart(T_DIRT_TOP, 'dirt-top', [px(x - 1, y - 9, w + 2, 1, DIRT_DARK, 'dirt-top')]),
    buildPart(T_GRASS, 'grass', [px(x, y - 12, w, 3, GRASS, 'grass')]),
    buildPart(T_GRASS_TOP, 'grass-top', [px(x + 1, y - 13, w - 2, 1, GRASS_LIGHT, 'grass-top')]),
  ];
  const groundTop = y - 13;
  BUILD_TOWERS.forEach(({ ox, w: tw, blocks, roof }, i) => {
    for (let j = 0; j < blocks; j += 1) {
      const top = groundTop - BLOCK_H * (j + 1);
      const delay = T_TOWER_START + j * T_BLOCK_STEP + i * T_TOWER_STAGGER;
      const isTop = j === blocks - 1;
      const rects = [
        px(x + ox, top, tw, BLOCK_H, STONE, `t${i}-${j}`),
        px(x + ox + tw - 1, top, 1, BLOCK_H, '#6e6e6e', `t${i}-${j}-shade`),
      ];
      if (isTop) rects.push(px(x + ox, top, tw, 1, GRASS_LIGHT, `t${i}-cap`));
      parts.push(buildPart(delay, `tower-${i}-${j}`, rects));
    }
    const towerTop = groundTop - BLOCK_H * blocks;
    const roofW = Math.max(3, tw - 4);
    const roofX = x + ox + Math.floor((tw - roofW) / 2);
    parts.push(
      buildPart(T_ROOF_START + i * T_ROOF_STEP, `roof-${i}`, [
        px(roofX, towerTop - 3, roofW, 3, roof, `r${i}`),
        px(roofX, towerTop - 3, roofW, 1, '#ffffff', `r${i}-hi`),
        px(roofX + roofW - 1, towerTop - 2, 1, 2, INK, `r${i}-shade`),
      ]),
    );
  });
  return parts;
};

const BUILD_ISLAND_RECTS = buildIsland();

/** 飛行機の軌道（.travel-track の座標、px）。左下から右下へ、上に膨らむ半円 */
const TRACK_W = 560;
const TRACK_H = 240;
const ARC_PATH = 'M 80 220 A 200 200 0 0 1 480 220';

/**
 * ローディング画面（全画面）。背景は 2D の横顔（空・雲・波の海）。
 * travel：遠くの島の前を飛行機が半円の軌道で飛ぶ（友達の島へ移動）。
 * build：中央の島が砂浜 → 土 → 草 → 塔 → 屋上の順に組み上がる（ログイン直後）。
 * 親は本物のロードが終わっても最短 2 秒は visible のままにし、false にしてから 0.4s 後にアンマウントする。
 */
export const TravelLoading = ({ variant, name, visible }: TravelLoadingProps) => {
  /** build の組み上がりは CSS の遅延付きアニメーション。周期ごとに key を変えて作り直す（ループ） */
  const [buildCycle, setBuildCycle] = useState(0);

  useEffect(() => {
    if (variant !== 'build') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setBuildCycle((c) => c + 1), BUILD_LOOP_SEC * 1000);
    return () => window.clearInterval(id);
  }, [variant]);

  const isBuild = variant === 'build';
  const rootClass = ['travel', isBuild ? 'travel-build' : 'travel-travel', visible ? '' : 'is-leaving']
    .filter((c) => c !== '')
    .join(' ');

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <svg
        className="travel-bg"
        viewBox={`0 0 ${BG_W} ${BG_H}`}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="travel-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5cb0ff" />
            <stop offset="1" stopColor="#cfeeff" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={BG_W} height={HORIZON_Y} fill="url(#travel-sky)" />
        {isBuild ? BUILD_CLOUDS : CLOUDS}
        {isBuild ? <g key={buildCycle}>{BUILD_ISLAND_RECTS}</g> : ISLAND_RECTS}
        <rect x={0} y={HORIZON_Y} width={BG_W} height={BG_H - HORIZON_Y} fill={SEA} />
        <g className="travel-wave travel-wave-back">{WAVE_BACK}</g>
        <g className="travel-wave travel-wave-front">{WAVE_FRONT}</g>
      </svg>

      {isBuild ? null : (
        <div className="travel-track" style={{ width: TRACK_W, height: TRACK_H }} aria-hidden="true">
          <svg className="travel-arc" viewBox={`0 0 ${TRACK_W} ${TRACK_H}`} width={TRACK_W} height={TRACK_H}>
            <path d={ARC_PATH} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="6 10" opacity={0.35} />
          </svg>
          <div className="travel-plane">
            <svg viewBox="0 0 16 16" width={64} height={64} shapeRendering="crispEdges">
              {PLANE_RECTS}
            </svg>
          </div>
        </div>
      )}

      <section className="travel-sign panel">
        <p className="travel-dest">{isBuild ? `${name} の島` : `${name} の島へ`}</p>
        <p className="travel-moving">
          {isBuild ? '準備中' : '移動中'}
          <span className="travel-dots">
            <span className="travel-dot">.</span>
            <span className="travel-dot">.</span>
            <span className="travel-dot">.</span>
          </span>
        </p>
      </section>
    </div>
  );
};
