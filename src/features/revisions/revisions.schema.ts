import { z } from "zod";

export const ContentRevisionTargetSchema = z.enum(["moment", "gallery"]);

/** 后台历史列表里的一行；正文只给个开头，不给整份快照。 */
export const ContentRevisionSummarySchema = z.object({
  id: z.number().int(),
  createdAt: z.string(),
  /** 日常取正文开头，相册取名称。 */
  title: z.string(),
  published: z.boolean(),
  publishedAt: z.string().nullable(),
  /** 这条和当前内容一致，也就是正在生效的版本。 */
  current: z.boolean(),
});

export const ContentRevisionListSchema = z.object({
  revisions: z.array(ContentRevisionSummarySchema),
});

const RevisionImageSchema = z.object({
  url: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
});

/** 日常快照的可见部分，密码哈希在服务层就摘掉了。 */
const MomentRevisionSnapshotSchema = z.object({
  body: z.string(),
  images: z.array(RevisionImageSchema),
  published: z.boolean(),
  publishedAt: z.string().nullable(),
  pinnedAt: z.string().nullable(),
});

const RevisionPhotoSchema = z.object({
  mediaId: z.number(),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  mimeType: z.string().nullable(),
  caption: z.string().nullable(),
});

const GalleryRevisionSnapshotSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  coverMediaId: z.number().nullable(),
  privacyProtected: z.boolean(),
  sortOrder: z.number(),
  // 早先存下的快照没有照片这一项，按空数组处理。
  photos: z.array(RevisionPhotoSchema).default([]),
  published: z.boolean(),
  publishedAt: z.string().nullable(),
  pinnedAt: z.string().nullable(),
});

export const ContentRevisionDetailSchema = z.object({
  id: z.number().int(),
  createdAt: z.string(),
  targetType: ContentRevisionTargetSchema,
  title: z.string(),
  snapshot: z.union([
    MomentRevisionSnapshotSchema,
    GalleryRevisionSnapshotSchema,
  ]),
  /** 这条和当前内容一致，也就是正在生效的版本。 */
  current: z.boolean(),
});

export const ListContentRevisionsInputSchema = z.object({
  targetType: ContentRevisionTargetSchema,
  targetId: z.number().int().positive(),
});

export const RestoreContentRevisionInputSchema =
  ListContentRevisionsInputSchema.extend({
    revisionId: z.number().int().positive(),
  });

export const FindContentRevisionInputSchema = RestoreContentRevisionInputSchema;

export const DeleteContentRevisionsInputSchema =
  ListContentRevisionsInputSchema.extend({
    revisionIds: z.array(z.number().int().positive()).min(1),
  });

export const DeleteContentRevisionsResultSchema = z.object({
  deletedIds: z.array(z.number().int()),
  deletedCount: z.number().int(),
});

export type ContentRevisionSummary = z.infer<
  typeof ContentRevisionSummarySchema
>;
export type ContentRevisionDetail = z.infer<typeof ContentRevisionDetailSchema>;
export type MomentRevisionSnapshotView = z.infer<
  typeof MomentRevisionSnapshotSchema
>;
export type GalleryRevisionSnapshotView = z.infer<
  typeof GalleryRevisionSnapshotSchema
>;
export type ListContentRevisionsInput = z.infer<
  typeof ListContentRevisionsInputSchema
>;
export type RestoreContentRevisionInput = z.infer<
  typeof RestoreContentRevisionInputSchema
>;
export type FindContentRevisionInput = z.infer<
  typeof FindContentRevisionInputSchema
>;
export type DeleteContentRevisionsInput = z.infer<
  typeof DeleteContentRevisionsInputSchema
>;
