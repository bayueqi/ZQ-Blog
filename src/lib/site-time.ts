/**
 * 站点固定时区。对外展示的日期、归档分组、后台“今天”以及定时发布的时刻
 * 全部按北京时间计算；库里存的仍是 UTC 时间戳。
 *
 * 使用固定 +08:00 偏移而不是 Intl 时区换算：中国不实行夏令时，偏移恒定，
 * 这样在 Worker 与浏览器两端得到的日历日完全一致，不依赖 ICU 数据。
 */
export const SITE_TIME_ZONE = "Asia/Shanghai";

const SITE_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 某一时刻对应的站点日历日（YYYY-MM-DD）。 */
export function siteDateKey(value: Date | number = new Date()): string {
  const time = typeof value === "number" ? value : value.getTime();
  return new Date(time + SITE_OFFSET_MS).toISOString().slice(0, 10);
}

/** 站点日历日的零点，也就是该日 00:00 +08:00 对应的时刻。 */
export function siteDayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

/** 某一时刻在站点时区里所属的年份。 */
export function siteYear(value: Date | number = new Date()): number {
  const time = typeof value === "number" ? value : value.getTime();
  return new Date(time + SITE_OFFSET_MS).getUTCFullYear();
}
