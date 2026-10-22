/**
 * Weeks in the writing calendar, ending with the current one. Defined here
 * because this module runs in the browser, and dashboard.ts imports the
 * server-only email service.
 */
export const DASHBOARD_WRITING_WEEKS = 26;

const HOUR_MS = 60 * 60 * 1000;

export type WritingLevel = 0 | 1 | 2 | 3 | 4;

export interface WritingDay {
  /** Local midnight. */
  date: Date;
  count: number;
  level: WritingLevel;
  /** Later today in this week; drawn as a blank cell. */
  future: boolean;
}

export interface WritingCalendar {
  /** Columns, oldest first; each a week from Monday to Sunday. */
  weeks: Array<Array<WritingDay>>;
  /** The week each month starts in, for labels above the columns. */
  months: Array<{ week: number; date: Date }>;
  activeDays: number;
  longestStreak: number;
  total: number;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** 1 to 4 by the share of the busiest day; 0 for none. */
export function writingLevel(count: number, max: number): WritingLevel {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as WritingLevel;
}

/**
 * Groups UTC hours of writing into the reader's local days (in a zone offset
 * by a half hour, an hour's first minutes can land on the day before) and
 * lays them out as `weeks` Monday-first columns ending with the week of
 * `today`.
 */
export function buildWritingCalendar(
  hours: ReadonlyArray<{ hour: number; count: number }>,
  today: Date,
  weeks = DASHBOARD_WRITING_WEEKS,
): WritingCalendar {
  const counts = new Map<string, number>();
  for (const { hour, count } of hours) {
    const key = dayKey(new Date(hour * HOUR_MS));
    counts.set(key, (counts.get(key) ?? 0) + count);
  }

  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const mondayOffset = (today.getDay() + 6) % 7;
  const firstDay = todayDate - mondayOffset - (weeks - 1) * 7;

  const days: Array<Omit<WritingDay, "level">> = [];
  for (let index = 0; index < weeks * 7; index++) {
    const date = new Date(year, month, firstDay + index);
    const future = date.getTime() > new Date(year, month, todayDate).getTime();
    days.push({
      date,
      count: future ? 0 : (counts.get(dayKey(date)) ?? 0),
      future,
    });
  }

  const max = Math.max(0, ...days.map((day) => day.count));
  let activeDays = 0;
  let longestStreak = 0;
  let streak = 0;
  let total = 0;
  for (const day of days) {
    total += day.count;
    if (day.count > 0) {
      activeDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else if (!day.future) {
      streak = 0;
    }
  }

  const columns: Array<Array<WritingDay>> = [];
  const months: WritingCalendar["months"] = [];
  for (let week = 0; week < weeks; week++) {
    const column = days
      .slice(week * 7, week * 7 + 7)
      .map((day) => ({ ...day, level: writingLevel(day.count, max) }));
    columns.push(column);
    const firstOfMonth = column.find((day) => day.date.getDate() === 1);
    if (firstOfMonth) months.push({ week, date: firstOfMonth.date });
  }

  return { weeks: columns, months, activeDays, longestStreak, total };
}
