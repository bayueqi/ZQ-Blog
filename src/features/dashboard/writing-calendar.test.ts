import { describe, expect, it } from "vitest";
import { buildWritingCalendar, writingLevel } from "./writing-calendar";

const HOUR_MS = 60 * 60 * 1000;

/** The UTC hour that holds local `date` at `hour` o'clock. */
function hourOf(year: number, month: number, day: number, hour = 12) {
  return Math.floor(new Date(year, month, day, hour).getTime() / HOUR_MS);
}

describe("writingLevel", () => {
  it("is 0 without writing and 4 on the busiest day", () => {
    expect(writingLevel(0, 8)).toBe(0);
    expect(writingLevel(1, 8)).toBe(1);
    expect(writingLevel(3, 8)).toBe(2);
    expect(writingLevel(5, 8)).toBe(3);
    expect(writingLevel(8, 8)).toBe(4);
  });
});

describe("buildWritingCalendar", () => {
  // Wednesday 14 October 2026, local time.
  const today = new Date(2026, 9, 14, 16, 30);

  it("ends with the current Monday-first week and blanks the days after today", () => {
    const calendar = buildWritingCalendar([], today, 4);
    expect(calendar.weeks).toHaveLength(4);
    const lastWeek = calendar.weeks.at(-1) ?? [];
    expect(lastWeek[0]?.date).toEqual(new Date(2026, 9, 12));
    expect(lastWeek.map((day) => day.future)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(calendar.weeks[0]?.[0]?.date).toEqual(new Date(2026, 8, 21));
    expect(calendar.months).toEqual([{ week: 1, date: new Date(2026, 9, 1) }]);
  });

  it("groups hours into local days and finds the longest streak", () => {
    const calendar = buildWritingCalendar(
      [
        { hour: hourOf(2026, 9, 5, 9), count: 2 },
        { hour: hourOf(2026, 9, 5, 23), count: 1 },
        { hour: hourOf(2026, 9, 6, 1), count: 1 },
        { hour: hourOf(2026, 9, 7), count: 4 },
        { hour: hourOf(2026, 9, 14, 8), count: 1 },
        // Before the window.
        { hour: hourOf(2026, 0, 1), count: 9 },
      ],
      today,
      4,
    );
    const byDate = new Map(
      calendar.weeks
        .flat()
        .map((day) => [day.date.getDate() + day.date.getMonth() * 100, day]),
    );
    expect(byDate.get(905)?.count).toBe(3);
    expect(byDate.get(906)?.count).toBe(1);
    expect(byDate.get(907)?.level).toBe(4);
    expect(calendar.activeDays).toBe(4);
    expect(calendar.longestStreak).toBe(3);
    expect(calendar.total).toBe(9);
  });
});
