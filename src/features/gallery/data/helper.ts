import { and, eq, isNull, lte, or } from "drizzle-orm";
import { GalleryCategoriesTable } from "@/lib/db/schema";

/**
 * 前台可见的相册集：已发布，并且没指定发布时间或发布时间已到。
 * 草稿即使填了发布时间也不对外。
 */
export function galleryVisible(now: Date = new Date()) {
  return and(
    eq(GalleryCategoriesTable.published, true),
    or(
      isNull(GalleryCategoriesTable.publishedAt),
      lte(GalleryCategoriesTable.publishedAt, now),
    ),
  );
}
