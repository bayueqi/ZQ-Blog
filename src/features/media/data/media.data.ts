import type { SQL } from "drizzle-orm";
import { and, count, desc, eq, inArray, lt, or, sql, sum } from "drizzle-orm";
import { escapeLikeString } from "@/features/media/data/helper";
import {
  GalleryCategoriesTable,
  GalleryPhotosTable,
  MediaTable,
  PostMediaTable,
  PostsTable,
  user,
} from "@/lib/db/schema";

export type Media = typeof MediaTable.$inferSelect;

// An Admin's avatar picked from the media library is a reference, like a Post
// image. Other users' avatar URLs are not, so they cannot pin media.
const usedAsAdminAvatar = sql`exists (select 1 from ${user} where ${user.role} = 'admin' and instr(${user.image}, '/images/' || ${MediaTable.key}) > 0)`;

// 相册集里的照片和相册集封面同样是引用，漏掉的话会被「清理未引用图片」误删。
const usedInGallery = sql`(
  exists (select 1 from ${GalleryPhotosTable} where ${GalleryPhotosTable.mediaId} = ${MediaTable.id})
  or exists (select 1 from ${GalleryCategoriesTable} where ${GalleryCategoriesTable.coverMediaId} = ${MediaTable.id})
)`;

const unreferenced = sql`not exists (select 1 from ${PostMediaTable} where ${PostMediaTable.mediaId} = ${MediaTable.id}) and not ${usedAsAdminAvatar} and not ${usedInGallery}`;

export async function isUsedAsAdminAvatar(db: DB, key: string) {
  const rows = await db
    .select({ id: MediaTable.id })
    .from(MediaTable)
    .where(and(eq(MediaTable.key, key), usedAsAdminAvatar))
    .limit(1);
  return rows.length > 0;
}

export async function isUsedInGallery(db: DB, key: string) {
  const rows = await db
    .select({ id: MediaTable.id })
    .from(MediaTable)
    .where(and(eq(MediaTable.key, key), usedInGallery))
    .limit(1);
  return rows.length > 0;
}

export type MediaFilter = "all" | "used" | "unused";

export type MediaListItem = Media & {
  postCount: number;
  /** 引用了这张图的相册集个数（照片与封面都算）。 */
  galleryCount: number;
  isCover: boolean;
};

export async function insertMedia(
  db: DB,
  data: typeof MediaTable.$inferInsert,
): Promise<Media> {
  const [inserted] = await db.insert(MediaTable).values(data).returning();
  return inserted;
}

export async function findMediaById(db: DB, id: number): Promise<Media | null> {
  const [media] = await db
    .select()
    .from(MediaTable)
    .where(eq(MediaTable.id, id))
    .limit(1);
  return media ?? null;
}

export async function findMediaByKey(
  db: DB,
  key: string,
): Promise<Media | null> {
  const [media] = await db
    .select()
    .from(MediaTable)
    .where(eq(MediaTable.key, key))
    .limit(1);
  return media ?? null;
}

export async function deleteMedia(db: DB, key: string) {
  await db.delete(MediaTable).where(eq(MediaTable.key, key));
}

export async function updateMediaName(db: DB, key: string, name: string) {
  await db
    .update(MediaTable)
    .set({ fileName: name })
    .where(eq(MediaTable.key, key));
}

export async function updateMediaFile(
  db: DB,
  key: string,
  data: {
    url: string;
    fileName: string;
    mimeType: string;
    sizeInBytes: number;
    width: number | null | undefined;
    height: number | null | undefined;
  },
): Promise<Media | null> {
  const [updated] = await db
    .update(MediaTable)
    .set({
      url: data.url,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeInBytes: data.sizeInBytes,
      width: data.width ?? null,
      height: data.height ?? null,
    })
    .where(eq(MediaTable.key, key))
    .returning();
  return updated ?? null;
}

const DEFAULT_PAGE_SIZE = 20;

export async function getMediaList(
  db: DB,
  options?: {
    cursor?: number;
    limit?: number;
    search?: string;
    filter?: MediaFilter;
    unusedOnly?: boolean;
  },
): Promise<{ items: Array<MediaListItem>; nextCursor: number | null }> {
  const {
    cursor,
    limit = DEFAULT_PAGE_SIZE,
    search,
    filter,
    unusedOnly,
  } = options ?? {};

  const conditions: Array<SQL> = [];
  if (cursor) {
    conditions.push(lt(MediaTable.id, cursor));
  }
  if (search) {
    const pattern = `%${escapeLikeString(search)}%`;
    conditions.push(sql`${MediaTable.fileName} LIKE ${pattern} ESCAPE '\\'`);
  }

  if (filter === "unused" || unusedOnly) {
    conditions.push(unreferenced);
  } else if (filter === "used") {
    conditions.push(sql`not (${unreferenced})`);
  }

  const items: Array<Media> = await db
    .select()
    .from(MediaTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(MediaTable.id))
    .limit(limit + 1);

  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop();
  }

  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items: await withUsage(db, items), nextCursor };
}

export async function getUnusedMediaKeys(db: DB): Promise<Array<string>> {
  const rows = await db
    .select({ key: MediaTable.key })
    .from(MediaTable)
    .where(unreferenced);
  return rows.map((row) => row.key);
}

export async function getMediaStats(db: DB) {
  const [totals] = await db
    .select({
      totalCount: count(),
      totalBytes: sum(MediaTable.sizeInBytes),
    })
    .from(MediaTable);

  const [unused] = await db
    .select({ unusedCount: count() })
    .from(MediaTable)
    .where(unreferenced);

  return {
    totalCount: Number(totals.totalCount ?? 0),
    unusedCount: Number(unused.unusedCount ?? 0),
    totalBytes: Number(totals.totalBytes ?? 0),
  };
}

export async function getTotalMediaSize(db: DB) {
  const stats = await getMediaStats(db);
  return stats.totalBytes;
}

const snapshotCoverMediaId = sql<
  number | null
>`json_extract(${PostsTable.publicSnapshotJson}, '$.cover.mediaId')`;

async function withUsage(
  db: DB,
  items: Array<Media>,
): Promise<Array<MediaListItem>> {
  if (items.length === 0) return [];

  const ids = items.map((item) => item.id);
  const [countRows, coverRows, galleryPhotoRows, galleryCoverRows] =
    await Promise.all([
      db
        .select({
          mediaId: PostMediaTable.mediaId,
          postCount: count(),
        })
        .from(PostMediaTable)
        .where(inArray(PostMediaTable.mediaId, ids))
        .groupBy(PostMediaTable.mediaId),
      db
        .select({
          coverMediaId: PostsTable.coverMediaId,
          snapshotCoverMediaId,
        })
        .from(PostsTable)
        .where(
          or(
            inArray(PostsTable.coverMediaId, ids),
            inArray(snapshotCoverMediaId, ids),
          ),
        ),
      db
        .selectDistinct({
          mediaId: GalleryPhotosTable.mediaId,
          categoryId: GalleryPhotosTable.categoryId,
        })
        .from(GalleryPhotosTable)
        .where(inArray(GalleryPhotosTable.mediaId, ids)),
      db
        .select({
          coverMediaId: GalleryCategoriesTable.coverMediaId,
          categoryId: GalleryCategoriesTable.id,
        })
        .from(GalleryCategoriesTable)
        .where(inArray(GalleryCategoriesTable.coverMediaId, ids)),
    ]);

  const postCountById = new Map(
    countRows.map((row) => [row.mediaId, Number(row.postCount)]),
  );
  const coverIds = new Set<number>();
  for (const row of coverRows) {
    if (row.coverMediaId != null) coverIds.add(row.coverMediaId);
    if (row.snapshotCoverMediaId != null) {
      coverIds.add(Number(row.snapshotCoverMediaId));
    }
  }

  const galleryCategoryIds = new Map<number, Set<number>>();
  const addGalleryRef = (mediaId: number | null, categoryId: number) => {
    if (mediaId == null) return;
    const existing = galleryCategoryIds.get(mediaId) ?? new Set<number>();
    existing.add(categoryId);
    galleryCategoryIds.set(mediaId, existing);
  };
  for (const row of galleryPhotoRows) {
    addGalleryRef(row.mediaId, row.categoryId);
  }
  for (const row of galleryCoverRows) {
    addGalleryRef(row.coverMediaId, row.categoryId);
  }

  return items.map((item) => ({
    ...item,
    postCount: postCountById.get(item.id) ?? 0,
    galleryCount: galleryCategoryIds.get(item.id)?.size ?? 0,
    isCover: coverIds.has(item.id),
  }));
}

export async function deleteUnusedMedia(db: DB): Promise<Array<string>> {
  const rows = await db
    .delete(MediaTable)
    .where(unreferenced)
    .returning({ key: MediaTable.key });
  return rows.map((row) => row.key);
}

export type LinkedGallery = {
  id: number;
  name: string;
  slug: string;
  isCover: boolean;
};

/** 引用了这张图的相册集，照片与封面都算。 */
export async function getGalleriesByMediaKey(
  db: DB,
  key: string,
): Promise<Array<LinkedGallery>> {
  const [media] = await db
    .select({ id: MediaTable.id })
    .from(MediaTable)
    .where(eq(MediaTable.key, key))
    .limit(1);
  if (!media) return [];

  const [photoRows, coverRows] = await Promise.all([
    db
      .selectDistinct({
        id: GalleryCategoriesTable.id,
        name: GalleryCategoriesTable.name,
        slug: GalleryCategoriesTable.slug,
      })
      .from(GalleryPhotosTable)
      .innerJoin(
        GalleryCategoriesTable,
        eq(GalleryPhotosTable.categoryId, GalleryCategoriesTable.id),
      )
      .where(eq(GalleryPhotosTable.mediaId, media.id)),
    db
      .select({
        id: GalleryCategoriesTable.id,
        name: GalleryCategoriesTable.name,
        slug: GalleryCategoriesTable.slug,
      })
      .from(GalleryCategoriesTable)
      .where(eq(GalleryCategoriesTable.coverMediaId, media.id)),
  ]);

  // 同一相册既是封面又收了这张图时，两种用途各列一条。
  return [
    ...photoRows.map((row) => ({ ...row, isCover: false })),
    ...coverRows.map((row) => ({ ...row, isCover: true })),
  ];
}
