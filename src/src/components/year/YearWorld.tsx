import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { type Group, type InstancedMesh, Matrix4, Object3D } from 'three';
import {
  BLOCK_HEIGHT,
  WATER_TOP_Y,
  colToX,
  rowToZ,
  towerTopY,
} from '../../lib/camera';
import { buildMonthGrid } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import type { IslandTheme } from '../../types/island';
import { BLOCK_GEOMETRY, BLOCK_MATERIALS } from '../models/blocks/blockMaterials';
import { type BlockKind, blockKindForLevel } from '../models/blocks/blockKinds';
import { type PixelLabel, PixelLabels } from '../month/PixelLabels';
import { YEAR_PITCH, islandCenter } from './yearLayout';

export interface YearWorldProps {
  /** false のときは描かない（group の visible=false）かつポインタのハンドラも付けない */
  visible: boolean;
  year: number;
  /** 3 年分すべての予定（隣の年の島もキャッシュとして描く） */
  byDate: Map<string, CalendarEvent[]>;
  /** その年の黄金郷の月（金ブロックで描く） */
  luxuriousMonthsOf: (year: number) => ReadonlySet<number>;
  hoveredMonth: number | null;
  onHoverMonth: (month: number | null) => void;
  onSelectMonth: (month: number) => void;
}

// ---------- ブロックの見た目（Block.tsx と同じ形と材質を InstancedMesh で使う） ----------

const BLOCK_KINDS = Object.keys(BLOCK_MATERIALS) as BlockKind[];

/** 島の幅（曜日 7 列） */
const ISLAND_WIDTH = 7;
/** 月ラベルの島の中心からの z オフセット（最大 6 行の島の手前の海の上） */
const MONTH_LABEL_Z = 4.1;
const MONTH_LABEL_PITCH = 0.22;
const INK = '#1b2a41';

/** 月の数字。年にもデータにも依らないので 1 回だけ作る */
const MONTH_LABELS: PixelLabel[] = Array.from({ length: 12 }, (_, i) => {
  const month = i + 1;
  const { x, z } = islandCenter(month);
  return {
    text: String(month),
    position: [x, WATER_TOP_Y + 0.05, z + MONTH_LABEL_Z],
    rotation: [-Math.PI / 2, 0, 0],
    color: INK,
    pitch: MONTH_LABEL_PITCH,
  };
});

// ---------- 1 年分のブロック行列 ----------

interface IslandShape {
  month: number;
  x: number;
  z: number;
  rows: number;
  /** いちばん高い塔の天面（予定のない島は地面 1 段ぶん） */
  height: number;
}

interface YearModel {
  /** ブロック種類ごとの行列（出てこない種類は入れない） */
  kinds: { kind: BlockKind; matrices: Matrix4[] }[];
  islands: IslandShape[];
}

const buildYearModel = (
  year: number,
  byDate: Map<string, CalendarEvent[]>,
  luxuriousMonths: ReadonlySet<number>,
): YearModel => {
  const dummy = new Object3D();
  const byKind = new Map<BlockKind, Matrix4[]>();
  const islands: IslandShape[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const { x, z } = islandCenter(month);
    const grid = buildMonthGrid(year, month);
    const theme: IslandTheme = luxuriousMonths.has(month) ? 'luxury' : 'plain';
    let maxCount = 0;

    for (const cell of grid.cells) {
      const count = byDate.get(cell.dateKey)?.length ?? 0;
      if (count === 0) continue;
      if (count > maxCount) maxCount = count;
      const cx = x + colToX(cell.col);
      const cz = z + rowToZ(cell.row, grid.rows);
      for (let level = 0; level <= count; level += 1) {
        const kind = blockKindForLevel(level, level === count, theme);
        dummy.position.set(cx, BLOCK_HEIGHT / 2 + BLOCK_HEIGHT * level, cz);
        dummy.updateMatrix();
        const list = byKind.get(kind);
        if (list) {
          list.push(dummy.matrix.clone());
        } else {
          byKind.set(kind, [dummy.matrix.clone()]);
        }
      }
    }

    islands.push({ month, x, z, rows: grid.rows, height: towerTopY(maxCount) });
  }

  const kinds = BLOCK_KINDS.flatMap((kind) => {
    const matrices = byKind.get(kind);
    return matrices ? [{ kind, matrices }] : [];
  });
  return { kinds, islands };
};

/** 1 種類のブロックを 1 つの InstancedMesh で描く */
interface BlockInstancesProps {
  kind: BlockKind;
  matrices: Matrix4[];
}

const BlockInstances = ({ kind, matrices }: BlockInstancesProps) => {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return (
    <instancedMesh
      key={matrices.length}
      ref={ref}
      args={[BLOCK_GEOMETRY, BLOCK_MATERIALS[kind], matrices.length]}
      // 島は原点から離れているので、ジオメトリ 1 個ぶんの境界球で間引かれないようにする
      frustumCulled={false}
    />
  );
};

// ---------- 1 年分の 12 島 ----------

interface YearIslandsProps {
  year: number;
  byDate: Map<string, CalendarEvent[]>;
  /** 黄金郷の月を "3,12" のように並べたキー。Set の参照が毎回変わっても再計算しないため */
  luxuryKey: string;
  x: number;
  /** 中央の年だけ true。ホバーとクリックを受ける */
  interactive: boolean;
  hoveredMonth: number | null;
  onHoverMonth: (month: number | null) => void;
  onSelectMonth: (month: number) => void;
}

const parseLuxuryKey = (key: string): ReadonlySet<number> =>
  new Set(key === '' ? [] : key.split(',').map(Number));

const YearIslands = ({
  year,
  byDate,
  luxuryKey,
  x,
  interactive,
  hoveredMonth,
  onHoverMonth,
  onSelectMonth,
}: YearIslandsProps) => {
  const model = useMemo(
    () => buildYearModel(year, byDate, parseLuxuryKey(luxuryKey)),
    [year, byDate, luxuryKey],
  );

  const handleOver = (month: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHoverMonth(month);
  };
  const handleOut = () => {
    document.body.style.cursor = 'auto';
    onHoverMonth(null);
  };
  const handleClick = (month: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectMonth(month);
  };

  return (
    <group position={[x, 0, 0]}>
      {model.kinds.map(({ kind, matrices }) => (
        <BlockInstances key={kind} kind={kind} matrices={matrices} />
      ))}
      <PixelLabels labels={MONTH_LABELS} />
      {interactive
        ? model.islands.map((island) => {
            const highlightHeight = island.height + BLOCK_HEIGHT + 0.02;
            return (
              <group key={island.month} position={[island.x, 0, island.z]}>
                <mesh
                  position={[0, island.height / 2, 0]}
                  onPointerOver={handleOver(island.month)}
                  onPointerOut={handleOut}
                  onClick={handleClick(island.month)}
                >
                  <boxGeometry args={[ISLAND_WIDTH, island.height, island.rows]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                {hoveredMonth === island.month ? (
                  <mesh position={[0, highlightHeight / 2, 0]}>
                    <boxGeometry args={[ISLAND_WIDTH + 0.04, highlightHeight, island.rows + 0.04]} />
                    <meshBasicMaterial color="#ffc83d" transparent opacity={0.16} depthWrite={false} />
                  </mesh>
                ) : null}
              </group>
            );
          })
        : null}
    </group>
  );
};

// ---------- 年のカルーセル ----------

const luxuryKeyOf = (months: ReadonlySet<number>): string =>
  [...months].sort((a, b) => a - b).join(',');

/** 年の切替スライドの速さ（指数補間の係数） */
const SLIDE_SPEED = 5;

/**
 * 年ビューの 3D ワールド。Canvas の子として置く。
 * 前後の年も描いておき（キャッシュ）、年が変わったら全体を横にスライドさせる
 */
export const YearWorld = ({
  visible,
  year,
  byDate,
  luxuriousMonthsOf,
  hoveredMonth,
  onHoverMonth,
  onSelectMonth,
}: YearWorldProps) => {
  const groupRef = useRef<Group>(null);
  /** 直前のフレームで中央にあった年。差があればその分だけずらしてから 0 へ戻す */
  const shownYear = useRef(year);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (!visible) {
      // 見えていない間の年の変化はスライドしない
      shownYear.current = year;
      group.position.x = 0;
      return;
    }
    if (shownYear.current !== year) {
      // 翌年へ進んだら、前の年が中央に見える位置（+YEAR_PITCH）から 0 へ滑る
      group.position.x += (year - shownYear.current) * YEAR_PITCH;
      shownYear.current = year;
    }
    const x = group.position.x;
    if (x === 0) return;
    const next = x * Math.exp(-delta * SLIDE_SPEED);
    group.position.x = Math.abs(next) < 0.003 ? 0 : next;
  });

  useEffect(() => {
    // 島をクリックして月へ降りた直後は onPointerOut が来ないので、ここでカーソルを戻す
    if (!visible) document.body.style.cursor = 'auto';
  }, [visible]);

  const years = [year - 1, year, year + 1];

  return (
    <group ref={groupRef} visible={visible}>
      {years.map((y, i) => (
        <YearIslands
          key={y}
          year={y}
          byDate={byDate}
          luxuryKey={luxuryKeyOf(luxuriousMonthsOf(y))}
          x={(i - 1) * YEAR_PITCH}
          interactive={visible && y === year}
          hoveredMonth={y === year ? hoveredMonth : null}
          onHoverMonth={onHoverMonth}
          onSelectMonth={onSelectMonth}
        />
      ))}
    </group>
  );
};
