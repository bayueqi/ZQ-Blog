import { count, eq, max } from "drizzle-orm";
import {
  FriendLinksTable,
  GalleryCategoriesTable,
  GalleryPhotosTable,
  MomentsTable,
  PostsTable,
} from "@/lib/db/schema";

/** 已发布的文章，不看是否加密、不看定时是否到点。 */
export async function countPublishedPosts(db: DB) {
  const [row] = await db
    .select({ total: count(), latest: max(PostsTable.publishedAt) })
    .from(PostsTable)
    .where(eq(PostsTable.status, "published"));

  return { total: row?.total ?? 0, latest: row?.latest ?? null };
}

/** 已发布的日常，上锁的也照常计数。 */
export async function countPublishedMoments(db: DB) {
  const [row] = await db
    .select({ total: count(), latest: max(MomentsTable.publishedAt) })
    .from(MomentsTable)
    .where(eq(MomentsTable.published, true));

  return { total: row?.total ?? 0, latest: row?.latest ?? null };
}

/** 已发布的相册集与照片，上锁的也照常计数。 */
export async function countPublicGallery(db: DB) {
  const [categories, photos] = await Promise.all([
    db
      .select({ total: count() })
      .from(GalleryCategoriesTable)
      .where(eq(GalleryCategoriesTable.published, true)),
    db
      .select({ total: count() })
      .from(GalleryPhotosTable)
      .innerJoin(
        GalleryCategoriesTable,
        eq(GalleryPhotosTable.categoryId, GalleryCategoriesTable.id),
      )
      .where(eq(GalleryCategoriesTable.published, true)),
  ]);

  return {
    galleries: categories[0]?.total ?? 0,
    photos: photos[0]?.total ?? 0,
  };
}

/** 审核通过的友链数量，以及最近一条通过的时间。 */
export async function countApprovedFriendLinks(db: DB) {
  const [row] = await db
    .select({ total: count(), latest: max(FriendLinksTable.createdAt) })
    .from(FriendLinksTable)
    .where(eq(FriendLinksTable.status, "approved"));

  return { total: row?.total ?? 0, latest: row?.latest ?? null };
}
