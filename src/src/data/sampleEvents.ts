/**
 * 固定データ（デモ用）：2026 年 1 年分のサンプル予定。
 * シード固定の乱数で生成するため、毎回同じ内容になる。
 * 繁忙月（3 月・10 月・12 月）と閑散月（8 月）を意図的に作り、山と谷を出す。
 */
import type { CalendarEvent, EventCategory } from '../types/calendar';
import { daysInMonth, toDateKey, weekdayOf } from '../lib/calendar';

export const SAMPLE_YEAR = 2026;

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

/** 必ず入れる「見せ場」の日 */
const SIGNATURE_DAYS: { date: string; categories: EventCategory[] }[] = [
  {
    date: toDateKey(SAMPLE_YEAR, 12, 19),
    categories: ['wedding', 'beauty', 'restaurant', 'travel', 'wedding', 'restaurant', 'beauty', 'travel', 'wedding'],
  },
  {
    date: toDateKey(SAMPLE_YEAR, 3, 27),
    categories: ['work', 'work', 'work', 'restaurant', 'work', 'gym', 'work', 'hospital'],
  },
  {
    date: toDateKey(SAMPLE_YEAR, 10, 10),
    categories: ['travel', 'travel', 'restaurant', 'beauty', 'gym', 'restaurant', 'travel'],
  },
  {
    date: toDateKey(SAMPLE_YEAR, 6, 6),
    categories: ['wedding', 'beauty', 'restaurant', 'travel'],
  },
];

const mulberry32 = (seed: number) => (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)];

const buildSampleEvents = (): CalendarEvent[] => {
  const rng = mulberry32(20260917);
  const events: CalendarEvent[] = [];
  const signature = new Map(SIGNATURE_DAYS.map((s) => [s.date, s.categories]));
  let id = 0;

  for (let month = 1; month <= 12; month++) {
    const total = daysInMonth(SAMPLE_YEAR, month);
    for (let day = 1; day <= total; day++) {
      const date = toDateKey(SAMPLE_YEAR, month, day);
      const fixed = signature.get(date);
      if (fixed) {
        for (const category of fixed) {
          events.push({ id: `ev-${id++}`, date, title: pick(rng, TITLES[category]), category });
        }
        continue;
      }
      const weekday = weekdayOf(SAMPLE_YEAR, month, day);
      const isWeekend = weekday === 0 || weekday === 6;
      const pool = isWeekend ? WEEKEND_CATEGORIES : WEEKDAY_CATEGORIES;
      if (rng() < 0.2) continue;
      const raw = rng() * 3.2 * MONTH_BUSYNESS[month] + (rng() < 0.15 ? 3 : 0);
      const count = Math.min(10, Math.floor(raw));
      for (let i = 0; i < count; i++) {
        const category = pick(rng, pool);
        events.push({ id: `ev-${id++}`, date, title: pick(rng, TITLES[category]), category });
      }
    }
  }
  return events;
};

export const sampleEvents: CalendarEvent[] = buildSampleEvents();
