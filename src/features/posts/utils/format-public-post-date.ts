import { SITE_TIME_ZONE } from "@/lib/site-time";
import { getLocale } from "@/paraglide/runtime";

// 站点日期一律按北京时间显示，与归档分组、后台“今天”保持同一口径。
// 显式指定 locale 与时区，SSR 文本与首次客户端渲染完全一致。
const formats = {
  zh: {
    full: new Intl.DateTimeFormat("zh-CN", {
      timeZone: SITE_TIME_ZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    short: new Intl.DateTimeFormat("zh-CN", {
      timeZone: SITE_TIME_ZONE,
      month: "2-digit",
      day: "2-digit",
    }),
  },
  en: {
    full: new Intl.DateTimeFormat("en-US", {
      timeZone: SITE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    short: new Intl.DateTimeFormat("en-US", {
      timeZone: SITE_TIME_ZONE,
      month: "2-digit",
      day: "2-digit",
    }),
  },
};

export function formatPublicPostDate(
  value: Date | string | number | null | undefined,
  {
    monthDay = false,
    locale = getLocale(),
  }: { monthDay?: boolean; locale?: "zh" | "en" } = {},
) {
  if (value == null) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formats[locale][monthDay ? "short" : "full"].format(date);
}
