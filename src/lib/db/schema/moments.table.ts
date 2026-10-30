import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";

/** 一段日常里的一张图，字段与 media 表一致，直接存下来省一次 join。 */
export interface MomentImage {
  url: string;
  width: number | null;
  height: number | null;
}

/**
 * 日常：朋友圈式短内容。`published_at` 为空即草稿；
 * `access_password_hash` 不为空时正文要凭密码才下发。
 */
export const MomentsTable = sqliteTable(
  "moments",
  {
    id,
    body: text().notNull(),
    images: text("images", { mode: "json" })
      .$type<Array<MomentImage>>()
      .notNull()
      .default(sql`'[]'`),
    accessPasswordHash: text("access_password_hash"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    /** 有值即置顶，排在列表最前面。 */
    pinnedAt: integer("pinned_at", { mode: "timestamp" }),
    createdAt,
    updatedAt,
  },
  (table) => [index("published_at_idx_moments").on(table.publishedAt)],
);

export type Moment = typeof MomentsTable.$inferSelect;
export type NewMoment = typeof MomentsTable.$inferInsert;
