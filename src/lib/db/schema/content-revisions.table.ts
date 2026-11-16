import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, id } from "./helper";
import type { MomentImage } from "./moments.table";

export const CONTENT_REVISION_TARGETS = ["moment", "gallery"] as const;
export type ContentRevisionTarget = (typeof CONTENT_REVISION_TARGETS)[number];

/** 日常的一份完整快照，恢复时整行写回。 */
export interface MomentRevisionSnapshot {
  body: string;
  images: Array<MomentImage>;
  accessPasswordHash: string | null;
  published: boolean;
  publishedAt: string | null;
  pinnedAt: string | null;
}

/** 相册里的一张照片，恢复时照这份重建照片表。 */
export interface GalleryRevisionPhoto {
  mediaId: number;
  url: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  caption: string | null;
}

/** 相册集快照：自身字段加上这一版的照片，恢复时整份写回。 */
export interface GalleryRevisionSnapshot {
  name: string;
  slug: string;
  description: string | null;
  coverMediaId: number | null;
  accessPasswordHash: string | null;
  privacyProtected: boolean;
  sortOrder: number;
  photos: Array<GalleryRevisionPhoto>;
  published: boolean;
  publishedAt: string | null;
  pinnedAt: string | null;
}

export type ContentRevisionSnapshot =
  | MomentRevisionSnapshot
  | GalleryRevisionSnapshot;

/**
 * 日常与相册集的历史版本：每次保存前把旧值整份存下来。
 * 一条记录只认「类型 + id」，不建外键——目标删了记录还留着也没关系。
 */
export const ContentRevisionsTable = sqliteTable(
  "content_revisions",
  {
    id,
    targetType: text("target_type", {
      enum: CONTENT_REVISION_TARGETS,
    }).notNull(),
    targetId: integer("target_id").notNull(),
    snapshotJson: text("snapshot_json", { mode: "json" })
      .$type<ContentRevisionSnapshot>()
      .notNull(),
    createdAt,
  },
  (table) => [
    index("content_revisions_target_created_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
  ],
);

export type ContentRevision = typeof ContentRevisionsTable.$inferSelect;
