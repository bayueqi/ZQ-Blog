/** 站点按东八区展示日期，搜索里的日期文本也按这个偏移算。 */
export const SEARCH_DATE_OFFSET = 8 * 60 * 60;

/**
 * 把日期摊平成可搜索的文本。年份、年月、年月日、带横线的写法各存一份，
 * 这样「2026」「2026-10」「2026年10月27日」「2026年10月7日」都能命中。
 */
export function searchableDateText(date: Date | null | undefined) {
  if (!date) return "";
  const shifted = new Date(date.getTime() + SEARCH_DATE_OFFSET * 1000);
  const iso = shifted.toISOString();
  const year = iso.slice(0, 4);
  const month = iso.slice(5, 7);
  const day = iso.slice(8, 10);
  return [
    year,
    `${year}年${month}月`,
    `${year}-${month}`,
    iso.slice(0, 10),
    `${year}年${month}月${day}日`,
    `${year}年${Number(month)}月${Number(day)}日`,
  ].join(" ");
}
