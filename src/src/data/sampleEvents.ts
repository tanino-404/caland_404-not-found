/**
 * 固定データ（デモ用）：2025・2026・2027 年の 3 年分のサンプル予定。
 * 年ごとにシード固定の乱数で生成するため、毎回同じ内容になる。
 * 繁忙月（3 月・10 月・12 月）と閑散月（8 月）を意図的に作り、山と谷を出す。
 * 2025 年は 2026 年の 0.8 倍。2027 年はまだ予定を入れていない未来なので、先の月ほど少なくする。
 * server/seed.py の build_sample_events と同じ出力。
 */
import type { CalendarEvent, EventCategory } from '../types/calendar';
import { daysInMonth, toDateKey, weekdayOf } from '../lib/calendar';

/** 最初に開く年 */
export const SAMPLE_YEAR = 2026;
/** サンプルを入れる年（昇順） */
export const SAMPLE_YEARS = [2025, 2026, 2027];

/** デモ用の初期メンバー。サンプル予定はこの 2 人のもの（結婚式など一部は 2 人で共有） */
export const SAMPLE_MEMBERS = ['たろう', 'はなこ'];
const SHARED_RATIO = 0.12;
/** 1 日に予定が入らない確率 */
const SKIP_RATIO = 0.25;
/** 1 日の件数の係数 */
const COUNT_SCALE = 2.8;

/** 年ごとの乱数シード。2026 年は 20260917 */
export const sampleEventSeed = (year: number): number => 20260917 + (year - 2026) * 10000;

const TITLES: Record<EventCategory, string[]> = {
  beauty: ['カット', 'カラー', 'パーマ', 'ヘッドスパ', 'ネイル', 'まつエク'],
  restaurant: ['ランチ会', '飲み会', 'カフェ', '同期会', '焼肉', 'ラーメン部'],
  work: ['定例MTG', '1on1', 'レビュー', '企画会議', '締め切り', '顧客訪問', '資料作成', '面談'],
  wedding: ['結婚式', '披露宴', '二次会'],
  hospital: ['歯医者', '健康診断', '眼科', '皮膚科', '予防接種'],
  gym: ['筋トレ', 'ランニング', 'ヨガ', 'スイム', 'ボルダリング'],
  travel: ['飛行機', '新幹線', 'ホテルチェックイン', '観光', '温泉'],
  school: ['英会話', '授業', 'ゼミ', '発表', '参観日', '塾'],
};

/** 月ごとの混み具合の重み */
const MONTH_BUSYNESS: Record<number, number> = {
  1: 0.5,
  2: 0.7,
  3: 1.7,
  4: 1.2,
  5: 0.9,
  6: 1.0,
  7: 0.9,
  8: 0.3,
  9: 1.1,
  10: 1.5,
  11: 1.0,
  12: 1.9,
};

const WEEKDAY_CATEGORIES: EventCategory[] = ['work', 'work', 'work', 'school', 'gym', 'hospital'];
const WEEKEND_CATEGORIES: EventCategory[] = ['beauty', 'restaurant', 'restaurant', 'gym', 'travel', 'school'];

/** 必ず入れる「見せ場」の日。月・日で持ち、SIGNATURE_YEARS の各年に同じ日付で入れる */
const SIGNATURE_DAYS: { month: number; day: number; categories: EventCategory[] }[] = [
  {
    month: 12,
    day: 19,
    categories: ['wedding', 'beauty', 'restaurant', 'travel', 'wedding', 'restaurant', 'beauty', 'travel', 'wedding'],
  },
  {
    month: 3,
    day: 27,
    categories: ['work', 'work', 'work', 'restaurant', 'work', 'gym', 'work', 'hospital'],
  },
  {
    month: 10,
    day: 10,
    categories: ['travel', 'travel', 'restaurant', 'beauty', 'gym', 'restaurant', 'travel'],
  },
  {
    month: 6,
    day: 6,
    categories: ['wedding', 'beauty', 'restaurant', 'travel'],
  },
];
/** 2027 年はまだ先の予定なので見せ場の日を入れない */
const SIGNATURE_YEARS = [2025, 2026];

/**
 * 年・月ごとの件数の倍率。2025 年は 2026 年の 0.8 倍。
 * 2027 年は 1 月 0.7 から 12 月 0.15 へ線形に減らす。
 */
const yearScale = (year: number, month: number): number => {
  if (year === 2025) return 0.8;
  if (year === 2027) return 0.7 - 0.05 * (month - 1);
  return 1;
};

const mulberry32 = (seed: number) => (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)];

/** 結婚式は 2 人で共有。それ以外は一定割合で共有、残りはどちらか 1 人。 */
const pickOwners = (rng: () => number, category: EventCategory): string[] => {
  if (category === 'wedding' || rng() < SHARED_RATIO) {
    return [...SAMPLE_MEMBERS];
  }
  return [pick(rng, SAMPLE_MEMBERS)];
};

const buildSampleEventsForYear = (year: number): CalendarEvent[] => {
  const rng = mulberry32(sampleEventSeed(year));
  const events: CalendarEvent[] = [];
  const signature = new Map<string, EventCategory[]>(
    SIGNATURE_YEARS.includes(year)
      ? SIGNATURE_DAYS.map((s) => [toDateKey(year, s.month, s.day), s.categories])
      : [],
  );
  let id = 0;
  const push = (date: string, category: EventCategory) => {
    events.push({
      id: `sample-${year}-${id++}`,
      date,
      title: pick(rng, TITLES[category]),
      category,
      owners: pickOwners(rng, category),
    });
  };

  for (let month = 1; month <= 12; month++) {
    const total = daysInMonth(year, month);
    const scale = yearScale(year, month);
    for (let day = 1; day <= total; day++) {
      const date = toDateKey(year, month, day);
      const fixed = signature.get(date);
      if (fixed) {
        for (const category of fixed) push(date, category);
        continue;
      }
      const weekday = weekdayOf(year, month, day);
      const isWeekend = weekday === 0 || weekday === 6;
      const pool = isWeekend ? WEEKEND_CATEGORIES : WEEKDAY_CATEGORIES;
      if (rng() < SKIP_RATIO) continue;
      const raw = (rng() * COUNT_SCALE * MONTH_BUSYNESS[month] + (rng() < 0.15 ? 3 : 0)) * scale;
      const count = Math.min(10, Math.floor(raw));
      for (let i = 0; i < count; i++) push(date, pick(rng, pool));
    }
  }
  return events;
};

export const sampleEvents: CalendarEvent[] = SAMPLE_YEARS.flatMap((year) =>
  buildSampleEventsForYear(year),
);
