import { useFrame } from '@react-three/fiber';
import { type ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import {
  BLOCK_HEIGHT,
  FRIEND_FLIGHT_DISTANCE,
  MONTH_PITCH,
  TOWER_WIDTH,
  WATER_TOP_Y,
  colToX,
  partnerZOffset,
  rowToZ,
  towerTopY,
} from '../../lib/camera';
import { type MonthGrid, buildMonthGrid } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import type { IslandTheme } from '../../types/island';
import type { EffectScene } from '../../types/plugins';
import { DayTower } from './DayTower';
import { EffectSprites, type RooftopSpot } from './EffectSprites';
import { Flight } from './Flight';
import { LibraryGrounds, LibraryScene } from './LibraryScene';
import { LuxuryFx } from './LuxuryFx';
import { LuxuryLandmark } from './LuxuryLandmark';
import { LuxuryMarina } from './LuxuryMarina';
import { Clouds, LuxurySky } from './LuxurySky';
import { MuscleFx } from './MuscleFx';
import { MuscleScene } from './MuscleScene';
import { MuscleSea } from './MuscleSea';
import { type PixelLabel, PixelLabels } from './PixelLabels';
import { Villagers } from './Villagers';
import { WeekdayHeader } from './WeekdayHeader';

/** DayTower のせり上がり（RISE 0.55s + 31 日 × 0.025s）が終わるまでの待ち時間 */
const RISE_TOTAL_SECONDS = 1.6;

/** せり上がりが終わるまで中身を隠す。島は key ごとに 1 回だけマウントされる */
const AfterRise = ({ children }: { children: ReactNode }) => {
  const groupRef = useRef<Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || group.visible) return;
    elapsed.current += delta;
    if (elapsed.current >= RISE_TOTAL_SECONDS) group.visible = true;
  });

  return (
    <group ref={groupRef} visible={false}>
      {children}
    </group>
  );
};

/** ふたりの島モードで、相方の島に渡すデータ */
export interface PartnerIsland {
  name: string;
  /** 相方が所有者の予定 */
  byDate: Map<string, CalendarEvent[]>;
  /** 自分と相方の両方が所有者の予定がある日付。飛行機が行き来する */
  commonDates: Set<string>;
}

/** 友達の島モードで渡すデータ。島は友達のものだけを建て、自分の島は出さない */
export interface FriendIsland {
  /** 自分と友達の両方が所有者の予定がある日付。塔から画面外へ飛行機が飛ぶ */
  commonDates: Set<string>;
  /** 飛行機をクリックしたときの日付 */
  onSelectFlight: (dateKey: string) => void;
}

const NO_EVENTS: CalendarEvent[] = [];

const buildDayLabels = (
  grid: MonthGrid,
  byDate: Map<string, CalendarEvent[]>,
  theme: IslandTheme,
): PixelLabel[] =>
  grid.cells.map((cell) => {
    const count = byDate.get(cell.dateKey)?.length ?? 0;
    if (count === 0) {
      // 海の日は水面に寝かせて置く（立てると水中に沈んで読めないため）
      return {
        text: String(cell.day),
        position: [colToX(cell.col), WATER_TOP_Y + 0.05, rowToZ(cell.row, grid.rows)],
        rotation: [-Math.PI / 2, 0, 0],
        color: '#1b2a41',
        pitch: 0.055,
      };
    }
    return {
      text: String(cell.day),
      position: [
        colToX(cell.col),
        towerTopY(count) - BLOCK_HEIGHT / 2,
        rowToZ(cell.row, grid.rows) + TOWER_WIDTH / 2 + 0.012,
      ],
      rotation: [0, 0, 0],
      color: theme === 'plain' ? (count >= 6 ? '#1b2a41' : '#fff6dc') : '#ffffff',
      pitch: 0.055,
    };
  });

interface FlightSpec {
  dateKey: string;
  x: number;
  z0: number;
  y0: number;
  z1: number;
  y1: number;
  apexY: number;
  phase: number;
}

/** 飛行軌道が同じ列のタワーを貫通しないよう、列ごとの最大天面高さを取る（屋上の建物ぶんは余白 1.35 で吸収） */
const columnMaxTops = (grid: MonthGrid, islands: Map<string, CalendarEvent[]>[]): number[] => {
  const colMaxTop = Array.from({ length: 7 }, () => BLOCK_HEIGHT);
  for (const cell of grid.cells) {
    for (const island of islands) {
      const top = towerTopY(island.get(cell.dateKey)?.length ?? 0);
      colMaxTop[cell.col] = Math.max(colMaxTop[cell.col], top);
    }
  }
  return colMaxTop;
};

const FLIGHT_APEX_MARGIN = 1.35;

const buildFlights = (
  grid: MonthGrid,
  byDate: Map<string, CalendarEvent[]>,
  partner: PartnerIsland | null,
  friend: FriendIsland | null,
): FlightSpec[] => {
  if (partner !== null) {
    // ふたりの島：自分の塔と相方の塔の間を往復する
    const zOff = partnerZOffset(grid.rows);
    const colMaxTop = columnMaxTops(grid, [byDate, partner.byDate]);
    return grid.cells
      .filter((cell) => partner.commonDates.has(cell.dateKey))
      .map((cell) => {
        const z0 = rowToZ(cell.row, grid.rows);
        return {
          dateKey: cell.dateKey,
          x: colToX(cell.col),
          z0,
          y0: towerTopY(byDate.get(cell.dateKey)?.length ?? 0),
          z1: z0 + zOff,
          y1: towerTopY(partner.byDate.get(cell.dateKey)?.length ?? 0),
          apexY: colMaxTop[cell.col] + FLIGHT_APEX_MARGIN,
          phase: cell.day * 0.9,
        };
      });
  }
  if (friend !== null) {
    // 友達の島：自分の島は無いので、友達の塔からカメラの奥（-z）へ飛んでいって戻る
    const colMaxTop = columnMaxTops(grid, [byDate]);
    return grid.cells
      .filter((cell) => friend.commonDates.has(cell.dateKey))
      .map((cell) => {
        const z0 = rowToZ(cell.row, grid.rows);
        const apexY = colMaxTop[cell.col] + FLIGHT_APEX_MARGIN;
        return {
          dateKey: cell.dateKey,
          x: colToX(cell.col),
          z0,
          y0: towerTopY(byDate.get(cell.dateKey)?.length ?? 0),
          z1: z0 - FRIEND_FLIGHT_DISTANCE,
          y1: apexY,
          apexY,
          phase: cell.day * 0.9,
        };
      });
  }
  return [];
};

/** 黄金郷の目印（浮かぶ巨大な $）を付ける、いちばん高い塔（予定 3 件以上） */
const tallestTower = (grid: MonthGrid, byDate: Map<string, CalendarEvent[]>) => {
  let best: { x: number; z: number; top: number; count: number } | null = null;
  for (const cell of grid.cells) {
    const count = byDate.get(cell.dateKey)?.length ?? 0;
    if (count >= 3 && (best === null || count > best.count)) {
      best = { x: colToX(cell.col), z: rowToZ(cell.row, grid.rows), top: towerTopY(count), count };
    }
  }
  return best;
};

const rooftopSpots = (grid: MonthGrid, byDate: Map<string, CalendarEvent[]>): RooftopSpot[] =>
  grid.cells
    .filter((cell) => (byDate.get(cell.dateKey)?.length ?? 0) > 0)
    .map((cell) => ({
      x: colToX(cell.col),
      y: towerTopY(byDate.get(cell.dateKey)?.length ?? 0),
      z: rowToZ(cell.row, grid.rows),
    }));

/** 島ごとの見た目：土台のテーマと、表示中プラグインのエフェクトに付いた絵（無ければ null） */
export interface IslandLook {
  theme: IslandTheme;
  scene: EffectScene | null;
  /** エフェクトが変わったら重ねる絵を作り直すためのキー */
  sceneKey: string;
}

interface IslandDecorProps {
  grid: MonthGrid;
  byDate: Map<string, CalendarEvent[]>;
  look: IslandLook;
  /** 日ビューのときは島の奥の大きな飾り（巨人・図書館・$）を出さない */
  dayView: boolean;
}

/** 中央の島だけに付ける、達成した島の大きな飾り（重いので隣の島には付けない） */
const IslandDecor = ({ grid, byDate, look, dayView }: IslandDecorProps) => {
  const { theme, scene, sceneKey } = look;
  const tallest = useMemo(() => tallestTower(grid, byDate), [grid, byDate]);
  const rooftops = useMemo(() => rooftopSpots(grid, byDate), [grid, byDate]);
  return (
    <>
      {theme === 'luxury' ? (
        <>
          <LuxuryMarina />
          <LuxurySky />
          {tallest !== null && !dayView ? <LuxuryLandmark x={tallest.x} z={tallest.z} top={tallest.top} /> : null}
        </>
      ) : null}
      {theme === 'muscle' ? (
        <>
          <Clouds />
          <MuscleFx active flare />
          <MuscleSea rows={grid.rows} />
          {dayView ? null : <MuscleScene rows={grid.rows} />}
        </>
      ) : null}
      {theme === 'library' ? (
        <>
          <Clouds />
          <LibraryGrounds rows={grid.rows} />
          {dayView ? null : <LibraryScene rows={grid.rows} />}
        </>
      ) : null}
      {scene?.sprites !== undefined ? (
        <AfterRise>
          <EffectSprites key={sceneKey} sprites={scene.sprites} rows={grid.rows} rooftops={rooftops} />
        </AfterRise>
      ) : null}
    </>
  );
};

interface MonthIslandProps {
  year: number;
  month: number;
  /** カルーセル内の x オフセット */
  x: number;
  byDate: Map<string, CalendarEvent[]>;
  members: string[];
  look: IslandLook;
  /** カルーセルの中央の島。達成した島の大きな飾りとレンズフレアはここだけに付ける */
  center: boolean;
  /** 中央の島の日ビューで選んでいる日 */
  selectedDay: number | null;
  hoveredKey: string | null;
  /** 省略すると飾りの島（隣の月、または非表示中） */
  onHover?: (dateKey: string | null) => void;
  onSelectDay?: (day: number) => void;
  friend: FriendIsland | null;
  partner: PartnerIsland | null;
}

/** 1 か月ぶんの島。WeekdayHeader・塔・村人・日付ラベル、黄金郷なら金貨の雨。中央の島には達成した島の飾り */
const MonthIsland = ({
  year,
  month,
  x,
  byDate,
  members,
  look,
  center,
  selectedDay,
  hoveredKey,
  onHover,
  onSelectDay,
  friend,
  partner,
}: MonthIslandProps) => {
  const { theme } = look;
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const dayLabels = useMemo(() => buildDayLabels(grid, byDate, theme), [grid, byDate, theme]);
  const partnerDayLabels = useMemo(
    () => (partner !== null ? buildDayLabels(grid, partner.byDate, theme) : []),
    [grid, partner, theme],
  );
  const flights = useMemo(
    () => buildFlights(grid, byDate, partner, friend),
    [grid, byDate, partner, friend],
  );
  // 友達の島では塔をクリックできない
  const onSelect = friend !== null ? undefined : onSelectDay;

  return (
    <group position={[x, 0, 0]}>
      <WeekdayHeader rows={grid.rows} />
      {grid.cells.map((cell) => (
        <DayTower
          key={cell.dateKey}
          cell={cell}
          rows={grid.rows}
          events={byDate.get(cell.dateKey) ?? NO_EVENTS}
          members={members}
          highlighted={hoveredKey === cell.dateKey || selectedDay === cell.day}
          onHover={onHover}
          onSelect={onSelect}
          theme={theme}
        />
      ))}
      {/* 黄金郷のお金の雨。常に置いておき、黄金郷の月に入ったらフェードイン、出たらフェードアウト */}
      <LuxuryFx active={theme === 'luxury'} flare={center} />
      {center ? (
        <group key={`${theme}-${look.sceneKey}`}>
          <IslandDecor grid={grid} byDate={byDate} look={look} dayView={selectedDay !== null} />
        </group>
      ) : null}
      <AfterRise>
        <Villagers cells={grid.cells} rows={grid.rows} byDate={byDate} theme={theme} />
        <PixelLabels labels={dayLabels} />
      </AfterRise>

      {partner !== null ? (
        <group position={[0, 0, partnerZOffset(grid.rows)]}>
          {grid.cells.map((cell) => (
            <DayTower
              key={`partner-${cell.dateKey}`}
              cell={cell}
              rows={grid.rows}
              events={partner.byDate.get(cell.dateKey) ?? NO_EVENTS}
              members={members}
              highlighted={false}
              theme={theme}
            />
          ))}
          <AfterRise>
            <Villagers cells={grid.cells} rows={grid.rows} byDate={partner.byDate} theme={theme} />
            <PixelLabels labels={partnerDayLabels} />
          </AfterRise>
        </group>
      ) : null}
      {flights.map((flight) => (
        <Flight
          key={flight.dateKey}
          x={flight.x}
          z0={flight.z0}
          y0={flight.y0}
          z1={flight.z1}
          y1={flight.y1}
          apexY={flight.apexY}
          phase={flight.phase}
          onClick={friend !== null ? () => friend.onSelectFlight(flight.dateKey) : undefined}
        />
      ))}
    </group>
  );
};

/** (year, month) を通しの月番号にする。隣の月の判定と、年またぎの前後の月の計算に使う */
const monthIndex = (year: number, month: number): number => year * 12 + (month - 1);

const monthFromIndex = (index: number): { year: number; month: number } => ({
  year: Math.floor(index / 12),
  month: (index % 12) + 1,
});

/** 月切替のスライドの速さ（指数補間の係数） */
const SLIDE_RATE = 6;

export interface MonthWorldProps {
  /** false なら group の visible=false にし、ポインタのハンドラも付けない */
  visible: boolean;
  year: number;
  month: number;
  /** 全期間の予定（隣の月の島をキャッシュとして描くため） */
  byDate: Map<string, CalendarEvent[]>;
  members: string[];
  /** 月ごとの島の見た目（表示中プラグインの達成で決まる） */
  lookOf: (year: number, month: number) => IslandLook;
  /** 日ビューで選んでいる日。null なら月俯瞰 */
  selectedDay: number | null;
  hoveredKey: string | null;
  onHover: (dateKey: string | null) => void;
  /** 省略すると見るだけ（友達の島） */
  onSelectDay?: (day: number) => void;
  /** 友達の島のとき。飛行機は中央の島だけ */
  friend: FriendIsland | null;
  /** 予備：ふたりの島。中央の島の奥に相方の島を置く */
  partner: PartnerIsland | null;
  /** この値が変わったあと、中央の島が最初に描画されたフレームで onReady を 1 回呼ぶ */
  readyKey: string;
  onReady: () => void;
}

/**
 * 月のカルーセル。中央の月と前後の月の 3 島を横に並べて同時にマウントし、
 * 月を送ると全体が横にスライドする（隣の島はすでに建っているので待ち時間が無い）
 */
export const MonthWorld = ({
  visible,
  year,
  month,
  byDate,
  members,
  lookOf,
  selectedDay,
  hoveredKey,
  onHover,
  onSelectDay,
  friend,
  partner,
  readyKey,
  onReady,
}: MonthWorldProps) => {
  const slideRef = useRef<Group>(null);
  const prevIndex = useRef(monthIndex(year, month));
  const readyDone = useRef<string | null>(null);

  const index = monthIndex(year, month);
  const prev = monthFromIndex(index - 1);
  const next = monthFromIndex(index + 1);

  // 隣の月へ送ったときは、前の中央の位置から 0 へスライドする。離れた月へ飛んだときは即時に 0
  useLayoutEffect(() => {
    const diff = index - prevIndex.current;
    prevIndex.current = index;
    const group = slideRef.current;
    if (!group) return;
    group.position.x = diff === 1 ? MONTH_PITCH : diff === -1 ? -MONTH_PITCH : 0;
  }, [index]);

  useFrame((_, delta) => {
    const group = slideRef.current;
    if (!group) return;
    if (Math.abs(group.position.x) < 0.002) {
      group.position.x = 0;
    } else {
      group.position.x *= Math.exp(-delta * SLIDE_RATE);
    }
    if (visible && readyDone.current !== readyKey) {
      readyDone.current = readyKey;
      onReady();
    }
  });

  return (
    <group visible={visible}>
      <group ref={slideRef}>
        <MonthIsland
          key={`${prev.year}-${prev.month}`}
          year={prev.year}
          month={prev.month}
          x={-MONTH_PITCH}
          byDate={byDate}
          members={members}
          look={lookOf(prev.year, prev.month)}
          center={false}
          selectedDay={null}
          hoveredKey={null}
          friend={null}
          partner={null}
        />
        <MonthIsland
          key={`${year}-${month}`}
          year={year}
          month={month}
          x={0}
          byDate={byDate}
          members={members}
          look={lookOf(year, month)}
          center
          selectedDay={selectedDay}
          hoveredKey={hoveredKey}
          onHover={visible ? onHover : undefined}
          onSelectDay={visible ? onSelectDay : undefined}
          friend={friend}
          partner={partner}
        />
        <MonthIsland
          key={`${next.year}-${next.month}`}
          year={next.year}
          month={next.month}
          x={MONTH_PITCH}
          byDate={byDate}
          members={members}
          look={lookOf(next.year, next.month)}
          center={false}
          selectedDay={null}
          hoveredKey={null}
          friend={null}
          partner={null}
        />
      </group>
    </group>
  );
};
