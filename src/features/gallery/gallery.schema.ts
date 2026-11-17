import { z } from "zod";

const CoverSchema = z
  .object({
    id: z.number(),
    url: z.string(),
    width: z.number().nullable(),
    height: z.number().nullable(),
  })
  .nullable();

/** 前台相册集卡片。locked 只是给界面打个锁标记，不代表能看到里面的照片。 */
export const GalleryCategoryCardSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  cover: CoverSchema,
  photoCount: z.number(),
  locked: z.boolean(),
  /** 置顶的排在列表最前面。 */
  pinned: z.boolean(),
  /** 没发布的相册是草稿，前台看不到。 */
  published: z.boolean(),
  /** 对外显示的发布时间；为空表示发布即当期。 */
  publishedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const GalleryPhotoSchema = z.object({
  id: z.number(),
  mediaId: z.number(),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  caption: z.string().nullable(),
  /** 用来判断是图还是视频，前台渲染要走不同的标签。 */
  mimeType: z.string(),
});

export const GalleryCategoryListResponseSchema = z.object({
  categories: z.array(GalleryCategoryCardSchema),
});

export const GalleryCategoryDetailSchema = z.object({
  category: GalleryCategoryCardSchema,
  photos: z.array(GalleryPhotoSchema),
  locked: z.boolean(),
});

export const CreateGalleryCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  coverMediaId: z.number().nullable().optional(),
  /** null/空 表示不设密码。 */
  password: z.string().min(1).max(100).nullable().optional(),
  /**
   * 发布时间，YYYY-MM-DD，按北京时间零点入库；填未来的日期就是定时发布。
   * 空字符串表示不指定，也就是发布即当期。不传表示保持原状。
   */
  publishedAt: z.string().max(10).nullable().optional(),
  /** 是否发布；不传表示保持原状。 */
  published: z.boolean().optional(),
});

export const UpdateGalleryCategoryInputSchema =
  CreateGalleryCategoryInputSchema.partial().extend({
    id: z.number(),
    sortOrder: z.number().int().optional(),
  });

export const AddGalleryPhotoInputSchema = z.object({
  categoryId: z.number(),
  mediaId: z.number(),
  caption: z.string().trim().max(200).optional(),
});

export const UpdateGalleryPhotoInputSchema = z.object({
  id: z.number(),
  caption: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const GalleryIdInputSchema = z.object({ id: z.number() });

export const GalleryPinInputSchema = z.object({
  id: z.number(),
  pinned: z.boolean(),
});

export const GalleryCategoryInputSchema = z.object({ slug: z.string() });

export const UnlockGalleryCategoryInputSchema = z.object({
  categoryId: z.number(),
  password: z.string().min(1).max(100),
});

export type GalleryCategoryCard = z.infer<typeof GalleryCategoryCardSchema>;
export type GalleryPhotoItem = z.infer<typeof GalleryPhotoSchema>;
export type CreateGalleryCategoryInput = z.infer<
  typeof CreateGalleryCategoryInputSchema
>;
export type UpdateGalleryCategoryInput = z.infer<
  typeof UpdateGalleryCategoryInputSchema
>;
export type AddGalleryPhotoInput = z.infer<typeof AddGalleryPhotoInputSchema>;
