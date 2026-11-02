export type EventCategory =
  | 'beauty'
  | 'restaurant'
  | 'work'
  | 'wedding'
  | 'hospital'
  | 'gym'
  | 'travel'
  | 'school';

export interface CalendarEvent {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  title: string;
  category: EventCategory;
  /** この予定を持つメンバー名（1 人以上）。2 人以上なら共有の予定 */
  owners: string[];
  /** 行き先。持ち物提案（/api/suggest）に使う。'' または未設定は場所なし */
  place?: string;
}

/**
 * 月ビューの島の並べ方。
 * - merged：メンバー全員の予定を 1 つの島に建てる（ホバーで持ち主の色）
 * - split ：自分の島と相方の島を海を挟んで並べ、ふたりの予定の日は飛行機が行き来する
 */
export type IslandLayout = 'merged' | 'split';

export type ViewState =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'day'; year: number; month: number; day: number };

export interface CategoryInfo {
  label: string;
  color: string;
}

export const CATEGORY_INFO: Record<EventCategory, CategoryInfo> = {
  beauty: { label: '美容室', color: '#ff8fb1' },
  restaurant: { label: '飲食', color: '#e0483e' },
  work: { label: '仕事', color: '#5b6b8c' },
  wedding: { label: '結婚式', color: '#ffd700' },
  hospital: { label: '病院', color: '#8fb8de' },
  gym: { label: 'ジム', color: '#ff7f11' },
  travel: { label: '旅行', color: '#2e86de' },
  school: { label: '学校', color: '#b5533c' },
};

export const CATEGORIES: EventCategory[] = [
  'beauty',
  'restaurant',
  'work',
  'wedding',
  'hospital',
  'gym',
  'travel',
  'school',
];
