import { getLocale } from "@/paraglide/runtime";

// Publication dates already use UTC days for validation and archive grouping.
// Explicit locale + timezone make the SSR text identical to the first client render.
const formats = {
  zh: {
    full: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    short: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "UTC",
      month: "2-digit",
      day: "2-digit",
    }),
  },
  en: {
    full: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    short: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
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
