import type { CalendarEvent } from '../types/calendar';

export const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const WEEKDAY_LABELS_JA = ['日', '月', '火', '水', '木', '金', '土'];
export const MONTH_NAMES_EN = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const toDateKey = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

export const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

/** 0 = Sunday */
export const weekdayOf = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day).getDay();

export interface MonthCell {
  day: number;
  /** 0 (Sun) - 6 (Sat) */
  col: number;
  /** 0-based week row */
  row: number;
  dateKey: string;
}

export interface MonthGrid {
  cells: MonthCell[];
  rows: number;
}

export const buildMonthGrid = (year: number, month: number): MonthGrid => {
  const first = weekdayOf(year, month, 1);
  const total = daysInMonth(year, month);
  const cells: MonthCell[] = [];
  for (let day = 1; day <= total; day++) {
    const index = first + day - 1;
    cells.push({
      day,
      col: index % 7,
      row: Math.floor(index / 7),
      dateKey: toDateKey(year, month, day),
    });
  }
  const rows = Math.floor((first + total - 1) / 7) + 1;
  return { cells, rows };
};

export const groupEventsByDate = (
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> => {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.date);
    if (list) {
      list.push(event);
    } else {
      map.set(event.date, [event]);
    }
  }
  return map;
};

export const countEventsInMonth = (
  byDate: Map<string, CalendarEvent[]>,
  year: number,
  month: number,
): number => {
  let count = 0;
  const total = daysInMonth(year, month);
  for (let day = 1; day <= total; day++) {
    count += byDate.get(toDateKey(year, month, day))?.length ?? 0;
  }
  return count;
};

export const busiestMonth = (
  byDate: Map<string, CalendarEvent[]>,
  year: number,
): number => {
  let best = 1;
  let bestCount = -1;
  for (let month = 1; month <= 12; month++) {
    const count = countEventsInMonth(byDate, year, month);
    if (count > bestCount) {
      best = month;
      bestCount = count;
    }
  }
  return best;
};

export const formatDateJa = (year: number, month: number, day: number): string =>
  `${year}年${month}月${day}日（${WEEKDAY_LABELS_JA[weekdayOf(year, month, day)]}）`;
