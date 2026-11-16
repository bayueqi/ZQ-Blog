import { siteDateKey } from "@/lib/site-time";

/** 服务器“今天”的站点日历日（YYYY-MM-DD），按北京时间计算。 */
export function serverTodayKey(now = new Date()): string {
  return siteDateKey(now);
}

/** 发布时间是否还没到，也就是定时发布但尚未生效。 */
export function isPublishPending(
  publishedAt: Date | string | number,
  now: Date = new Date(),
): boolean {
  const time = new Date(publishedAt).getTime();
  return Number.isFinite(time) && time > now.getTime();
}
