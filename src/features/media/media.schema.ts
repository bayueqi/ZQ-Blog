import { z } from "zod";

/**
 * R2 单对象到 5TB 才封顶，卡住的是 Worker：请求体免费与 Pro 档 100MB，
 * 而 `request.formData()` 会把整个文件读进内存（128MB 上限），
 * 贴着 100MB 收容易直接 OOM，所以留一半余量。
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
/** 只收浏览器都能直接播的两种，mov 这类要转码才能放，先不放进来。 */
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"];
export const ACCEPTED_MEDIA_TYPES = [
  ...ACCEPTED_IMAGE_TYPES,
  ...ACCEPTED_VIDEO_TYPES,
];

export const MediaKeyInputSchema = z.object({
  key: z.string(),
});

export const UpdateMediaNameInputSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
});

export const GetMediaListInputSchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  filter: z.enum(["all", "used", "unused"]).optional(),
  unusedOnly: z.boolean().optional(),
});

export const ImportMediaUrlInputSchema = z.object({
  url: z.string().min(1),
});

export type UpdateMediaNameInput = z.infer<typeof UpdateMediaNameInputSchema>;
export type GetMediaListInput = z.infer<typeof GetMediaListInputSchema>;
