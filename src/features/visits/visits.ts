/** 概览只展示最近这些天，网页上取哪一天按 UTC 算。 */
export const VISIT_RANGE_DAYS = 7;

export const VISIT_DIMENSIONS = ["browser", "device", "os", "country"] as const;

export type VisitDimensionKey = (typeof VISIT_DIMENSIONS)[number];

/** 一行就是某个维度组合在某个 UTC 日的访问次数。 */
export type VisitRow = {
  day: string;
  country: string;
  browser: string;
  device: string;
  os: string;
  views: number;
};

export type VisitorItem = {
  /** 浏览器和系统直接给名字，设备给 desktop 这类键，国家给代码。 */
  label: string;
  views: number;
  /** 与 `days` 一一对应。 */
  daily: Array<number>;
};

export type VisitorStats = {
  /** 最近 VISIT_RANGE_DAYS 个 UTC 日，旧的在前。 */
  days: Array<string>;
  total: number;
  dimensions: Array<{ key: VisitDimensionKey; items: Array<VisitorItem> }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function lastUtcDays(today: Date, days: number) {
  const current = Date.parse(`${utcDay(today)}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) =>
    utcDay(new Date(current - (days - 1 - index) * DAY_MS)),
  );
}

/** 把按天存的行摊成四个维度各自的排行，每个排行带每天的走势。 */
export function buildVisitorStats(
  rows: ReadonlyArray<VisitRow>,
  today: Date,
): VisitorStats {
  const days = lastUtcDays(today, VISIT_RANGE_DAYS);
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const buckets = new Map<VisitDimensionKey, Map<string, Array<number>>>();
  let total = 0;

  for (const row of rows) {
    const index = dayIndex.get(row.day);
    if (index === undefined) continue;
    total += row.views;
    for (const key of VISIT_DIMENSIONS) {
      const label = row[key];
      let byLabel = buckets.get(key);
      if (!byLabel) {
        byLabel = new Map();
        buckets.set(key, byLabel);
      }
      let daily = byLabel.get(label);
      if (!daily) {
        daily = days.map(() => 0);
        byLabel.set(label, daily);
      }
      daily[index] = (daily[index] ?? 0) + row.views;
    }
  }

  return {
    days,
    total,
    dimensions: VISIT_DIMENSIONS.map((key) => ({
      key,
      items: [...(buckets.get(key) ?? [])]
        .map(([label, daily]) => ({
          label,
          views: daily.reduce((sum, views) => sum + views, 0),
          daily,
        }))
        .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label)),
    })),
  };
}
