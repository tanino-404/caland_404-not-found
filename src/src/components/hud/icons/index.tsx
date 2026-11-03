import type { ReactElement } from 'react';

/**
 * 下部バーと設定画面で使う「機能ロゴ」。16×16 のピクセルアートをインライン SVG で描く。
 * 各アイコンは 16 文字 × 16 行の文字列で表し、1 文字が 1 ピクセル。'.' は透明、それ以外は palette で色に変える。
 */

export interface IconProps {
  size?: number;
}

export type IconComponent = (props: IconProps) => ReactElement;

type Palette = Record<string, string>;

const GRID = 16;

/** 共通色（global.css のトークンと同じ値） */
const INK = '#1b2a41';
const PAPER = '#fff8e7';
const GOLD = '#ffc83d';

interface PixelArtProps {
  rows: readonly string[];
  palette: Palette;
  size: number;
}

/** 横に続く同色のピクセルを 1 本の rect にまとめて描く */
const PixelArt = ({ rows, palette, size }: PixelArtProps) => {
  if (rows.length !== GRID) {
    throw new Error(`PixelArt: 行数が ${GRID} ではありません（${rows.length} 行）`);
  }
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    if (row.length !== GRID) {
      throw new Error(`PixelArt: ${y} 行目の長さが ${GRID} ではありません（"${row}"）`);
    }
    let x = 0;
    while (x < GRID) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      const fill = palette[ch];
      if (fill === undefined) {
        throw new Error(`PixelArt: palette に "${ch}" がありません（${y} 行目）`);
      }
      let end = x + 1;
      while (end < GRID && row[end] === ch) end++;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={fill} />);
      x = end;
    }
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects}
    </svg>
  );
};

/* ---------- 年カレンダー：12 マスのグリッド ---------- */

const YEAR_ROWS = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.khrrrrrrrrrrrk.',
  '.krrrrrrrrrrrrk.',
  '.kkkkkkkkkkkkkk.',
  '.kbbpbbpggpbbpk.',
  '.kbbpbbpggpbbpk.',
  '.kppppppppppppk.',
  '.kggpbbpbbpggpk.',
  '.kggpbbpbbpggpk.',
  '.kppppppppppppk.',
  '.kbbpggpbbpbbpk.',
  '.kbbpggpbbpbbpk.',
  '.kppppppppppppk.',
  '.kkkkkkkkkkkkkk.',
  '................',
] as const;

const YEAR_PALETTE: Palette = { k: INK, r: '#e0483e', h: '#ff8a80', p: PAPER, b: '#5cb0ff', g: GOLD };

export const IconYear = ({ size = 32 }: IconProps) => (
  <PixelArt rows={YEAR_ROWS} palette={YEAR_PALETTE} size={size} />
);

/* ---------- 月カレンダー：1 枚のカレンダー（上に綴じ、下に日付マス） ---------- */

const MONTH_ROWS = [
  '................',
  '...kk.....kk....',
  '...kk.....kk....',
  '.kkkkkkkkkkkkkk.',
  '.krkkrrrrrkkrrk.',
  '.khrrrrrrrrrrrk.',
  '.kkkkkkkkkkkkkk.',
  '.kppppppppppppk.',
  '.kpbbpbbpggpbbk.',
  '.kpbbpbbpggpbbk.',
  '.kppppppppppppk.',
  '.kpbbpbbpbbpbbk.',
  '.kpbbpbbpbbpbbk.',
  '.kppppppppppppk.',
  '.kkkkkkkkkkkkkk.',
  '................',
] as const;

const MONTH_PALETTE: Palette = { k: INK, r: '#e0483e', h: '#ff8a80', p: PAPER, b: '#5cb0ff', g: GOLD };

export const IconMonth = ({ size = 32 }: IconProps) => (
  <PixelArt rows={MONTH_ROWS} palette={MONTH_PALETTE} size={size} />
);

/* ---------- 友達の島に訪問：並んだ 2 人 ---------- */

const FRIEND_ROWS = [
  '................',
  '..kkkk...kkkk...',
  '.kssssk.kssssk..',
  '.kshssk.kshssk..',
  '.kssssk.kssssk..',
  '..kkkk...kkkk...',
  'kkkkkkkkkkkkkkk.',
  'kaaaaaakbbbbbbk.',
  'kahaaaakbhbbbbk.',
  'kaaaaaakbbbbbbk.',
  'kaaaaaakbbbbbbk.',
  'kaaaaaakbbbbbbk.',
  'kaaaaaakbbbbbbk.',
  'kkkkkkkkkkkkkkk.',
  '................',
  '................',
] as const;

const FRIEND_PALETTE: Palette = { k: INK, s: '#ffd9b3', h: '#ffffff', a: '#ff2e88', b: '#19c2ff' };

export const IconFriend = ({ size = 32 }: IconProps) => (
  <PixelArt rows={FRIEND_ROWS} palette={FRIEND_PALETTE} size={size} />
);

/* ---------- 管理機能：木の宝箱 ---------- */

const MANAGE_ROWS = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.khhhhhhhhhhhhk.',
  '.kooooooooooook.',
  '.kooooooooooook.',
  '.koooonnnnooook.',
  '.kkkkknggnkkkkk.',
  '.kddddnggnddddk.',
  '.kddddnnnnddddk.',
  '.kddddddddddddk.',
  '.kddddddddddddk.',
  '.kddddddddddddk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
  '................',
] as const;

const MANAGE_PALETTE: Palette = {
  k: INK,
  h: '#e8c48a',
  o: '#c8864a',
  d: '#9a5a2e',
  n: '#3b3b3b',
  g: GOLD,
};

export const IconManage = ({ size = 32 }: IconProps) => (
  <PixelArt rows={MANAGE_ROWS} palette={MANAGE_PALETTE} size={size} />
);

/* ---------- 家計簿：金貨の入った袋 ---------- */

const LEDGER_ROWS = [
  '................',
  '......kkkk......',
  '.....kggggk.....',
  '......kkkk......',
  '.....kkkkkk.....',
  '....kbhbbbbk....',
  '...kbhbbbbbbk...',
  '..kbbbgbbgbbbk..',
  '..kbbbbggbbbbk..',
  '..kbbbggggbbbk..',
  '..kbbbbggbbbbk..',
  '..kbbbbggbbbbk..',
  '...kbbbbbbbbk...',
  '....kkkkkkkk....',
  '................',
  '................',
] as const;

const LEDGER_PALETTE: Palette = { k: INK, g: GOLD, b: '#c8864a', h: '#e8c48a' };

export const IconLedger = ({ size = 32 }: IconProps) => (
  <PixelArt rows={LEDGER_ROWS} palette={LEDGER_PALETTE} size={size} />
);

/* ---------- 筋トレ：ダンベル ---------- */

const TRAINING_ROWS = [
  '................',
  '................',
  '.kk..........kk.',
  'khdk........khdk',
  'khdkkk....kkkhdk',
  'khdkhdk..khdkhdk',
  'khdkhdkkkkhdkhdk',
  'khdkhdbbbbhdkhdk',
  'khdkhdbbbbhdkhdk',
  'khdkhdkkkkhdkhdk',
  'khdkhdk..khdkhdk',
  'khdkkk....kkkhdk',
  'khdk........khdk',
  '.kk..........kk.',
  '................',
  '................',
] as const;

const TRAINING_PALETTE: Palette = { k: INK, d: '#5e5e5e', h: '#9a9a9a', b: '#d0d0d0' };

export const IconTraining = ({ size = 32 }: IconProps) => (
  <PixelArt rows={TRAINING_ROWS} palette={TRAINING_PALETTE} size={size} />
);

/* ---------- 勉強：本と鉛筆 ---------- */

const STUDY_ROWS = [
  '............kkkk',
  '............keek',
  '............kyyk',
  '.kkkkkkkkkk.kyyk',
  '.kbhbbbbbbk.kyyk',
  '.kbhbbbbbbk.kyyk',
  '.kbhbbbbbbk.kyyk',
  '.kbhgggbbbk.kyyk',
  '.kbhbbbbbbk.kyyk',
  '.kbhbbbbbbk.kwwk',
  '.kbhbbbbbbk..kk.',
  '.knnnnnnnnk..k..',
  '.kkkkkkkkkk.....',
  '................',
  '................',
  '................',
] as const;

const STUDY_PALETTE: Palette = {
  k: INK,
  b: '#2e86de',
  h: '#8fc4ff',
  g: GOLD,
  n: '#ffffff',
  e: '#ff8fb1',
  y: GOLD,
  w: '#e8c48a',
};

export const IconStudy = ({ size = 32 }: IconProps) => (
  <PixelArt rows={STUDY_ROWS} palette={STUDY_PALETTE} size={size} />
);

/* ---------- NISA：右肩上がりの折れ線グラフ ---------- */

const NISA_ROWS = [
  '................',
  '.k..............',
  '.k............g.',
  '.k...........gg.',
  '.k..........gg..',
  '.k.........gg...',
  '.k........gg....',
  '.k...g...gg.....',
  '.k..ggg.gg......',
  '.k.gg.ggg.......',
  '.kgg...g........',
  '.kg.............',
  '.k..............',
  '.k..............',
  '.kkkkkkkkkkkkkk.',
  '................',
] as const;

const NISA_PALETTE: Palette = { k: INK, g: GOLD };

export const IconNisa = ({ size = 32 }: IconProps) => (
  <PixelArt rows={NISA_ROWS} palette={NISA_PALETTE} size={size} />
);

/* ---------- 設定：歯車 ---------- */

const SETTINGS_ROWS = [
  '......kkkk......',
  '......khgk......',
  '..kk..khgk..kk..',
  '..kgkkkhgkkkgk..',
  '..khhhhggggggk..',
  '...kgggkkgggk...',
  '..kkggk..kggkk..',
  '.kgggk....kgggk.',
  '.kgggk....kgggk.',
  '..kkggk..kggkk..',
  '...kgggkkgggk...',
  '..kggggggggggk..',
  '..kgkkkggkkkgk..',
  '..kk..kggk..kk..',
  '......kggk......',
  '......kkkk......',
] as const;

const SETTINGS_PALETTE: Palette = { k: INK, g: '#8d8d8d', h: '#c4c4c4' };

export const IconSettings = ({ size = 32 }: IconProps) => (
  <PixelArt rows={SETTINGS_ROWS} palette={SETTINGS_PALETTE} size={size} />
);

/* ---------- ログアウト：扉と矢印 ---------- */

const LOGOUT_ROWS = [
  '................',
  '.kkkkkk.........',
  '.khdddk.........',
  '.khdddk.........',
  '.khdddk....k....',
  '.khdddk....kk...',
  '.khdgdk....kgk..',
  '.khdgdkkkkkkggk.',
  '.khdddkkgggggggk',
  '.khdddkkkkkkggk.',
  '.khdddk....kgk..',
  '.khdddk....kk...',
  '.khdddk....k....',
  '.kkkkkk.........',
  '................',
  '................',
] as const;

const LOGOUT_PALETTE: Palette = { k: INK, d: '#b5533c', h: '#d98a6a', g: GOLD };

export const IconLogout = ({ size = 32 }: IconProps) => (
  <PixelArt rows={LOGOUT_ROWS} palette={LOGOUT_PALETTE} size={size} />
);
