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
}

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
