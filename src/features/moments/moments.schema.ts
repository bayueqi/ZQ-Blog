import { z } from "zod";

export const MomentImageSchema = z.object({
  url: z.string().min(1),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});

/** 前台拿到的一条日常；锁定时 body 与 images 都是空的。 */
export const MomentCardSchema = z.object({
  id: z.number().int(),
  body: z.string(),
  images: z.array(MomentImageSchema),
  publishedAt: z.string().nullable(),
  locked: z.boolean(),
  pinned: z.boolean(),
});

export const MomentListSchema = z.object({
  moments: z.array(MomentCardSchema),
});

export const MomentIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const MomentPinInputSchema = z.object({
  id: z.number().int().positive(),
  pinned: z.boolean(),
});

export const MomentWriteInputSchema = z.object({
  body: z.string().trim().max(2000).default(""),
  images: z.array(MomentImageSchema).max(9).default([]),
  /** 空字符串（或 null）表示取消密码；不传表示保持原密码不变。 */
  password: z.string().max(100).nullable().optional(),
  published: z.boolean().default(true),
});

export const MomentUpdateInputSchema = MomentWriteInputSchema.extend({
  id: z.number().int().positive(),
});

export const AdminMomentSchema = MomentCardSchema.extend({
  hasPassword: z.boolean(),
  published: z.boolean(),
  updatedAt: z.string().nullable(),
});

export const AdminMomentListSchema = z.object({
  moments: z.array(AdminMomentSchema),
});

export const UnlockMomentInputSchema = z.object({
  id: z.number().int().positive(),
  password: z.string().min(1).max(100),
});

export type MomentImage = z.infer<typeof MomentImageSchema>;
export type MomentCard = z.infer<typeof MomentCardSchema>;
export type AdminMoment = z.infer<typeof AdminMomentSchema>;
export type MomentWriteInput = z.infer<typeof MomentWriteInputSchema>;
export type MomentUpdateInput = z.infer<typeof MomentUpdateInputSchema>;
