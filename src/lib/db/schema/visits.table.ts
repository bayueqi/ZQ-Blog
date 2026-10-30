import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { id } from "./helper";

/**
 * 访客人次：按 UTC 日和 UA 里的三个维度累加，一个组合一行，
 * 存储量只跟维度组合数有关，不跟访问量有关。
 */
export const VisitStatsTable = sqliteTable(
  "visit_stats",
  {
    id,
    /** UTC 日期，形如 2026-10-22。 */
    day: text().notNull(),
    /** ISO 3166-1 国家代码，取自 Cloudflare，未知为 ZZ。 */
    country: text().notNull(),
    browser: text().notNull(),
    device: text().notNull(),
    os: text().notNull(),
    views: integer().notNull().default(0),
  },
  (table) => [
    uniqueIndex("day_dimensions_idx_visit_stats").on(
      table.day,
      table.country,
      table.browser,
      table.device,
      table.os,
    ),
  ],
);

// ==================== types ====================
export type VisitStatRow = typeof VisitStatsTable.$inferSelect;
