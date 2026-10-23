import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";
import { MediaTable } from "./media.table";

/** 相册集：一组照片，密码设在这一层，可单独加密。 */
export const GalleryCategoriesTable = sqliteTable(
  "gallery_categories",
  {
    id,
    name: text().notNull(),
    slug: text().notNull().unique(),
    description: text(),
    coverMediaId: integer("cover_media_id").references(() => MediaTable.id, {
      onDelete: "set null",
    }),
    accessPasswordHash: text("access_password_hash"),
    // 打开后解锁前连名称、描述、封面、创建时间都不给看。
    privacyProtected: integer("privacy_protected", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [index("sort_order_idx_gallery_categories").on(table.sortOrder)],
);

/** 照片：相册集里的一张图，指向 media 表。 */
export const GalleryPhotosTable = sqliteTable(
  "gallery_photos",
  {
    id,
    categoryId: integer("category_id")
      .notNull()
      .references(() => GalleryCategoriesTable.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => MediaTable.id, { onDelete: "cascade" }),
    caption: text(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
  },
  (table) => [index("category_idx_gallery_photos").on(table.categoryId)],
);

export type GalleryCategory = typeof GalleryCategoriesTable.$inferSelect;
export type GalleryPhoto = typeof GalleryPhotosTable.$inferSelect;
