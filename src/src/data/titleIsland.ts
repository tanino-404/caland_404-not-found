import { toDateKey } from '../lib/calendar';
import { CATEGORY_INFO, type CalendarEvent, type EventCategory } from '../types/calendar';

/**
 * タイトル（ログアウト中）画面に建てる飾り島の固定データ。
 * 実データは見せないので、2026 年 6 月（5 行のグリッド）に山と谷がはっきり出るよう手で置いている。
 * 真ん中あたり（16・17・23 日）に 6〜7 段の高い塔を立て、周りを 0〜3 段の低い日と海で囲む。
 */
export const TITLE_YEAR = 2026;
export const TITLE_MONTH = 6;
/** 飾り島の持ち主。実在のメンバーと混ざらない名前にしている */
export const TITLE_OWNER = 'caland';

/** 日ごとの予定カテゴリ。添字 + 1 が日付、配列の長さがその日の塔の高さ（0 は海） */
const TITLE_DAY_CATEGORIES: readonly (readonly EventCategory[])[] = [
  /* 1 (Mon) */ ['work'],
  /* 2 */ [],
  /* 3 */ ['beauty', 'restaurant'],
  /* 4 */ ['gym'],
  /* 5 */ [],
  /* 6 (Sat) */ ['travel', 'restaurant', 'wedding'],
  /* 7 (Sun) */ ['school', 'hospital'],
  /* 8 */ [],
  /* 9 */ ['work', 'gym', 'restaurant'],
  /* 10 */ ['beauty', 'work', 'school', 'travel'],
  /* 11 */ ['hospital', 'work'],
  /* 12 */ [],
  /* 13 (Sat) */ ['wedding'],
  /* 14 (Sun) */ [],
  /* 15 */ ['work', 'gym', 'beauty'],
  /* 16 */ ['restaurant', 'work', 'school', 'hospital', 'travel', 'gym'],
  /* 17 */ ['wedding', 'beauty', 'restaurant', 'work', 'school', 'travel', 'hospital'],
  /* 18 */ ['gym', 'work', 'restaurant', 'beauty', 'school'],
  /* 19 */ ['travel', 'hospital'],
  /* 20 (Sat) */ [],
  /* 21 (Sun) */ ['restaurant'],
  /* 22 */ ['work', 'school', 'gym', 'beauty'],
  /* 23 */ ['hospital', 'travel', 'wedding', 'restaurant', 'work', 'school'],
  /* 24 */ ['gym', 'beauty', 'work'],
  /* 25 */ [],
  /* 26 */ ['restaurant', 'travel'],
  /* 27 (Sat) */ ['wedding', 'beauty', 'hospital', 'school', 'gym'],
  /* 28 (Sun) */ [],
  /* 29 */ ['work', 'restaurant', 'travel'],
  /* 30 */ ['school'],
];

const buildTitleEvents = (): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  TITLE_DAY_CATEGORIES.forEach((categories, index) => {
    const day = index + 1;
    for (const category of categories) {
      events.push({
        id: `title-${events.length + 1}`,
        date: toDateKey(TITLE_YEAR, TITLE_MONTH, day),
        title: CATEGORY_INFO[category].label,
        category,
        owners: [TITLE_OWNER],
      });
    }
  });
  return events;
};

/** 飾り島の予定（67 件）。ログアウト中の 3D 表示にだけ使う */
export const titleEvents: CalendarEvent[] = buildTitleEvents();
