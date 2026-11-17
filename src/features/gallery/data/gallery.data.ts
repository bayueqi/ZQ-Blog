import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { galleryVisible } from "@/features/gallery/data/helper";
import type { DB } from "@/lib/db";
import {
  GalleryCategoriesTable,
  GalleryPhotosTable,
  MediaTable,
} from "@/lib/db/schema";

const categoryFields = {
  id: GalleryCategoriesTable.id,
  name: GalleryCategoriesTable.name,
  slug: GalleryCategoriesTable.slug,
  description: GalleryCategoriesTable.description,
  accessPasswordHash: GalleryCategoriesTable.accessPasswordHash,
  sortOrder: GalleryCategoriesTable.sortOrder,
  pinnedAt: GalleryCategoriesTable.pinnedAt,
  published: GalleryCategoriesTable.published,
  publishedAt: GalleryCategoriesTable.publishedAt,
  createdAt: GalleryCategoriesTable.createdAt,
  updatedAt: GalleryCategoriesTable.updatedAt,
};

const coverFields = {
  coverId: MediaTable.id,
  coverUrl: MediaTable.url,
  coverWidth: MediaTable.width,
  coverHeight: MediaTable.height,
};

/** `publishedOnly` 给前台：草稿和还没到发布日的相册都不下发。 */
export async function listCategories(
  db: DB,
  options: { publishedOnly?: boolean } = {},
) {
  const rows = await db
    .select({ ...categoryFields, ...coverFields })
    .from(GalleryCategoriesTable)
    .leftJoin(
      MediaTable,
      eq(MediaTable.id, GalleryCategoriesTable.coverMediaId),
    )
    .where(
      options.publishedOnly ? galleryVisible() : undefined,
    )
    .orderBy(
      desc(GalleryCategoriesTable.pinnedAt),
      asc(GalleryCategoriesTable.sortOrder),
      asc(GalleryCategoriesTable.id),
    );

  const counts = await db
    .select({
      categoryId: GalleryPhotosTable.categoryId,
      photos: count(GalleryPhotosTable.id),
    })
    .from(GalleryPhotosTable)
    .groupBy(GalleryPhotosTable.categoryId);
  const byCategory = new Map(counts.map((row) => [row.categoryId, row.photos]));

  return rows.map((row) => ({
    ...row,
    photoCount: byCategory.get(row.id) ?? 0,
  }));
}

export async function findCategoryBySlug(db: DB, slug: string) {
  const [row] = await db
    .select({ ...categoryFields, ...coverFields })
    .from(GalleryCategoriesTable)
    .leftJoin(
      MediaTable,
      eq(MediaTable.id, GalleryCategoriesTable.coverMediaId),
    )
    .where(eq(GalleryCategoriesTable.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function findCategoryById(db: DB, id: number) {
  const [row] = await db
    .select()
    .from(GalleryCategoriesTable)
    .where(eq(GalleryCategoriesTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function listPhotos(db: DB, categoryId: number) {
  return await db
    .select({
      id: GalleryPhotosTable.id,
      mediaId: GalleryPhotosTable.mediaId,
      caption: GalleryPhotosTable.caption,
      sortOrder: GalleryPhotosTable.sortOrder,
      url: MediaTable.url,
      width: MediaTable.width,
      height: MediaTable.height,
      mimeType: MediaTable.mimeType,
    })
    .from(GalleryPhotosTable)
    .innerJoin(MediaTable, eq(MediaTable.id, GalleryPhotosTable.mediaId))
    .where(eq(GalleryPhotosTable.categoryId, categoryId))
    .orderBy(asc(GalleryPhotosTable.sortOrder), asc(GalleryPhotosTable.id));
}

export async function insertCategory(
  db: DB,
  data: typeof GalleryCategoriesTable.$inferInsert,
) {
  const [row] = await db
    .insert(GalleryCategoriesTable)
    .values(data)
    .returning();
  return row;
}

export async function updateCategory(
  db: DB,
  id: number,
  data: Partial<typeof GalleryCategoriesTable.$inferInsert>,
) {
  const [row] = await db
    .update(GalleryCategoriesTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(GalleryCategoriesTable.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCategory(db: DB, id: number) {
  await db
    .delete(GalleryCategoriesTable)
    .where(eq(GalleryCategoriesTable.id, id));
}

export async function insertPhoto(
  db: DB,
  data: typeof GalleryPhotosTable.$inferInsert,
) {
  const [row] = await db.insert(GalleryPhotosTable).values(data).returning();
  return row;
}

export async function updatePhoto(
  db: DB,
  id: number,
  data: Partial<typeof GalleryPhotosTable.$inferInsert>,
) {
  const [row] = await db
    .update(GalleryPhotosTable)
    .set(data)
    .where(eq(GalleryPhotosTable.id, id))
    .returning();
  return row ?? null;
}

export async function deletePhoto(db: DB, id: number) {
  await db.delete(GalleryPhotosTable).where(eq(GalleryPhotosTable.id, id));
}

/** 恢复旧版本时先清空，再按快照重建。 */
export async function deletePhotosOfCategory(db: DB, categoryId: number) {
  await db
    .delete(GalleryPhotosTable)
    .where(eq(GalleryPhotosTable.categoryId, categoryId));
}

export async function findPhotoById(db: DB, id: number) {
  const [row] = await db
    .select()
    .from(GalleryPhotosTable)
    .where(eq(GalleryPhotosTable.id, id))
    .limit(1);
  return row ?? null;
}

/** 快照里的媒体可能已经被清掉，恢复时只补还在的。 */
export async function findExistingMediaIds(db: DB, ids: Array<number>) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: MediaTable.id })
    .from(MediaTable)
    .where(inArray(MediaTable.id, ids));
  return rows.map((row) => row.id);
}

export async function findCategorySlugTaken(
  db: DB,
  slug: string,
  excludeId?: number,
) {
  const conditions = [eq(GalleryCategoriesTable.slug, slug)];
  if (excludeId !== undefined) {
    conditions.push(ne(GalleryCategoriesTable.id, excludeId));
  }
  const [row] = await db
    .select({ id: GalleryCategoriesTable.id })
    .from(GalleryCategoriesTable)
    .where(and(...conditions))
    .limit(1);
  return Boolean(row);
}
