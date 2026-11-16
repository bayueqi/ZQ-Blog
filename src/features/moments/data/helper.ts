import { and, eq, isNull, lte, or } from "drizzle-orm";
import { MomentsTable } from "@/lib/db/schema";

/**
 * 前台可见的日常：已发布，并且没指定发布时间或发布时间已到。
 * 没指定发布时间的那条，发布时间按创建时刻算。
 */
export function momentVisible(now: Date = new Date()) {
  return and(
    eq(MomentsTable.published, true),
    or(isNull(MomentsTable.publishedAt), lte(MomentsTable.publishedAt, now)),
  );
}
