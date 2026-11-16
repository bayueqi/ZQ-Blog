import { and, count, eq, isNotNull, max, sql } from "drizzle-orm";
import { galleryVisible } from "@/features/gallery/data/helper";
import { momentVisible } from "@/features/moments/data/helper";
import { publicVisible } from "@/features/posts/data/helper";
import {
  FriendLinksTable,
  GalleryCategoriesTable,
  GalleryPhotosTable,
  MomentsTable,
  PostsTable,
} from "@/lib/db/schema";

const postIsPublic = and(
  isNotNull(PostsTable.publicSlug),
  publicVisible(),
);

export async function countPublishedPosts(db: DB) {
  const [row] = await db
    .select({
      total: count(),
      latest: max(
        sql<string>`json_extract(${PostsTable.publicSnapshotJson}, '$.publishedAt')`,
      ),
    })
    .from(PostsTable)
    .where(postIsPublic);

  return { total: row?.total ?? 0, latest: row?.latest ?? null };
}

/** 已发布的日常；上锁的也算，访客在列表里看得见它。 */
export async function countPublishedMoments(db: DB) {
  const [row] = await db
    .select({ total: count(), latest: max(MomentsTable.publishedAt) })
    .from(MomentsTable)
    .where(momentVisible());

  return { total: row?.total ?? 0, latest: row?.latest ?? null };
}

/** 相册集与照片，隐私保护的既不计数也不露名字。 */
export async function countPublicGallery(db: DB) {
  const [categories, photos] = await Promise.all([
    db
      .select({ total: count() })
      .from(GalleryCategoriesTable)
      .where(and(galleryVisible(), eq(GalleryCategoriesTable.privacyProtected, false))),
    db
      .select({ total: count() })
      .from(GalleryPhotosTable)
      .innerJoin(
        GalleryCategoriesTable,
        eq(GalleryPhotosTable.categoryId, GalleryCategoriesTable.id),
      )
      .where(and(galleryVisible(), eq(GalleryCategoriesTable.privacyProtected, false))),
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
