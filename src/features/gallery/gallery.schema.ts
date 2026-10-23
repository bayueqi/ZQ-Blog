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
  /** 解锁前连名称、描述、封面、创建时间都不下发。 */
  privacyProtected: z.boolean(),
  createdAt: z.string().nullable(),
});

export const GalleryPhotoSchema = z.object({
  id: z.number(),
  mediaId: z.number(),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  caption: z.string().nullable(),
});

export const GalleryCategoryListResponseSchema = z.object({
  categories: z.array(GalleryCategoryCardSchema),
});

export const GalleryCategoryDetailSchema = z.object({
  category: GalleryCategoryCardSchema,
  photos: z.array(GalleryPhotoSchema),
  locked: z.boolean(),
});

const slugField = z
  .string()
  .trim()
  .max(120)
  .regex(/^[a-z0-9\u4E00-\u9FA5-]+$/u, "只能用字母、数字、汉字和横杠")
  .optional();

export const CreateGalleryCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugField,
  description: z.string().trim().max(500).optional(),
  coverMediaId: z.number().nullable().optional(),
  /** null/空 表示不设密码。 */
  password: z.string().min(1).max(100).nullable().optional(),
  /** 设了密码才能开的隐私保护。 */
  privacyProtected: z.boolean().optional(),
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
