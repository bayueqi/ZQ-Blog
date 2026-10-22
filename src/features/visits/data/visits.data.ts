import { gte, sql } from "drizzle-orm";
import { VisitStatsTable } from "@/lib/db/schema";
import type { VisitRow } from "../visits";

/** 同一组合累加一行，不新增行。 */
export async function recordVisit(db: DB, visit: Omit<VisitRow, "views">) {
  await db
    .insert(VisitStatsTable)
    .values({ ...visit, views: 1 })
    .onConflictDoUpdate({
      target: [
        VisitStatsTable.day,
        VisitStatsTable.country,
        VisitStatsTable.browser,
        VisitStatsTable.device,
        VisitStatsTable.os,
      ],
      set: { views: sql`${VisitStatsTable.views} + 1` },
    });
}

export async function listVisitsSince(db: DB, day: string) {
  try {
    return await db
      .select({
        day: VisitStatsTable.day,
        country: VisitStatsTable.country,
        browser: VisitStatsTable.browser,
        device: VisitStatsTable.device,
        os: VisitStatsTable.os,
        views: VisitStatsTable.views,
      })
      .from(VisitStatsTable)
      .where(gte(VisitStatsTable.day, day));
  } catch {
    // 表还没迁移时当没有数据，不能让概览整页挂掉。
    return [];
  }
}
