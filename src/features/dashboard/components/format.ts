import { getLocale } from "@/paraglide/runtime";

function intlLocale() {
  return getLocale() === "zh" ? "zh-CN" : "en-US";
}

/*
 * Intl formatters are expensive to build and the heatmap asks for one label
 * per day, so each shape is built once per locale and reused.
 */
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function dateFormat(key: string, options: Intl.DateTimeFormatOptions) {
  const tag = intlLocale();
  const id = `${tag}|${key}`;
  let formatter = dateFormats.get(id);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(tag, options);
    dateFormats.set(id, formatter);
  }
  return formatter;
}

function numberFormat(key: string, options?: Intl.NumberFormatOptions) {
  const tag = intlLocale();
  const id = `${tag}|${key}`;
  let formatter = numberFormats.get(id);
  if (!formatter) {
    formatter = new Intl.NumberFormat(tag, options);
    numberFormats.set(id, formatter);
  }
  return formatter;
}

/** A whole number with the locale's thousands separators. */
export function formatCount(value: number) {
  return numberFormat("count").format(value);
}

/** Today's date with its weekday, e.g. "10月14日星期三". */
export function formatToday(date: Date) {
  return dateFormat("today", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

/** A calendar day, e.g. "2026年10月14日". */
export function formatDay(date: Date) {
  return dateFormat("day", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** A month label, e.g. "10月" or "Oct". */
export function formatMonth(date: Date) {
  return dateFormat("month", { month: "short" }).format(date);
}

/** A weekday's narrow name, e.g. "一" or "M". */
export function formatWeekdayNarrow(date: Date) {
  return dateFormat("weekday", { weekday: "narrow" }).format(date);
}
