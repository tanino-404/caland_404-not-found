/**
 * 固定データ（デモ用）：相方の 2026 年 1 年分のサンプル予定。
 * 「ふたりの島」モードで、自分の島の奥（海の向こう）に表示する。
 *
 * 自分の予定（sampleEvents）から一部をコピーした「共通の予定」を含み、
 * その日付の集合を partnerCommonDates としてエクスポートする。
 * 共通の予定の日には、月ビューで島と島をつなぐ橋が架かる。
 */
import { daysInMonth, groupEventsByDate, toDateKey, weekdayOf } from '../lib/calendar';
import type { CalendarEvent, EventCategory } from '../types/calendar';
import { SAMPLE_YEAR, TITLES, mulberry32, pick, sampleEvents } from './sampleEvents';

/** 相方の月ごとの混み具合の重み（自分とは山谷をずらす） */
const MONTH_BUSYNESS: Record<number, number> = {
  1: 0.9,
  2: 0.5,
  3: 1.4,
  4: 0.8,
  5: 1.1,
  6: 0.9,
  7: 1.6,
  8: 0.6,
  9: 1.0,
  10: 1.3,
  11: 0.7,
  12: 1.7,
};

const WEEKDAY_CATEGORIES: EventCategory[] = ['work', 'work', 'work', 'work', 'gym', 'school'];
const WEEKEND_CATEGORIES: EventCategory[] = ['gym', 'travel', 'restaurant', 'restaurant', 'beauty', 'school'];

/** 見せ場の日：自分の予定から先頭 take 件をコピーして「共通の予定」にする */
const SIGNATURE_COMMON: { date: string; take: number }[] = [
  { date: toDateKey(SAMPLE_YEAR, 12, 19), take: 3 },
  { date: toDateKey(SAMPLE_YEAR, 10, 10), take: 2 },
  { date: toDateKey(SAMPLE_YEAR, 6, 6), take: 2 },
];

/**
 * 共通の予定を作る。
 * 見せ場の日に加えて、残りの各月から 10〜25 日で最初に予定がある日を 1 日選び、
 * その日の先頭 2 件をコピーする（毎月どこかに橋が架かるようにする）。
 */
const buildCommon = (
  mineByDate: Map<string, CalendarEvent[]>,
): { events: CalendarEvent[]; dates: Set<string> } => {
  const events: CalendarEvent[] = [];
  const dates = new Set<string>();
  let id = 0;
  const copy = (event: CalendarEvent): CalendarEvent => ({ ...event, id: `pv-c${id++}` });

  for (const { date, take } of SIGNATURE_COMMON) {
    const source = mineByDate.get(date);
    if (!source || source.length === 0) {
      throw new Error(`samplePartnerEvents: 共通予定のコピー元が空です: ${date}`);
    }
    for (const event of source.slice(0, take)) {
      events.push(copy(event));
    }
    dates.add(date);
  }

  const signatureMonths = new Set(SIGNATURE_COMMON.map((s) => Number(s.date.slice(5, 7))));
  for (let month = 1; month <= 12; month++) {
    if (signatureMonths.has(month)) continue;
    for (let day = 10; day <= 25; day++) {
      const date = toDateKey(SAMPLE_YEAR, month, day);
      const source = mineByDate.get(date);
      if (source && source.length > 0) {
        for (const event of source.slice(0, 2)) {
          events.push(copy(event));
        }
        dates.add(date);
        break;
      }
    }
  }
  return { events, dates };
};

const COMMON = buildCommon(groupEventsByDate(sampleEvents));

/** ふたりの共通の予定がある日付。月ビューでこの日に橋が架かる */
export const partnerCommonDates: Set<string> = COMMON.dates;

const buildPartnerEvents = (): CalendarEvent[] => {
  const rng = mulberry32(20260918);
  const events = [...COMMON.events];
  let id = 0;

  for (let month = 1; month <= 12; month++) {
    const total = daysInMonth(SAMPLE_YEAR, month);
    for (let day = 1; day <= total; day++) {
      const date = toDateKey(SAMPLE_YEAR, month, day);
      const weekday = weekdayOf(SAMPLE_YEAR, month, day);
      const isWeekend = weekday === 0 || weekday === 6;
      const pool = isWeekend ? WEEKEND_CATEGORIES : WEEKDAY_CATEGORIES;
      const raw = rng() * 3.0 * MONTH_BUSYNESS[month] + (rng() < 0.12 ? 3 : 0);
      const count = Math.min(9, Math.floor(raw));
      for (let i = 0; i < count; i++) {
        const category = pick(rng, pool);
        events.push({ id: `pv-${id++}`, date, title: pick(rng, TITLES[category]), category });
      }
    }
  }
  return events;
};

export const samplePartnerEvents: CalendarEvent[] = buildPartnerEvents();
