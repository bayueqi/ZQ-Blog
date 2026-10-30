import { z } from "zod";
import { NullableJsonContentSchema } from "@/features/posts/schema/json-content.schema";

export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.number().optional().default(10),
  v: z.string(),
});

const UpsertSearchDocSchema = z.object({
  id: z.number(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  contentJson: NullableJsonContentSchema.optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().nullable().optional(),
  publishedAt: z
    .union([z.date(), z.string().pipe(z.coerce.date())])
    .nullable()
    .optional(),
});

const DeleteSearchDocSchema = z.object({
  id: z.number(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type UpsertSearchDocInput = z.infer<typeof UpsertSearchDocSchema>;
export type DeleteSearchDocInput = z.infer<typeof DeleteSearchDocSchema>;

export type SearchHitKind = "post" | "moment" | "gallery" | "friend-link";

/** 站内搜索的统一结果，前端按 kind 决定链接和标签。 */
export type SearchHit = {
  kind: SearchHitKind;
  id: number;
  title: string;
  /** 带 `<mark>` 的标题，没有命中高亮时为 null。 */
  titleHtml: string | null;
  /** 命中处的句子，一行一条，带 `<mark>` 以及回跳原文的定位信息。 */
  snippets: Array<{ html: string; term: string; occurrence: number }>;
  /** 关键词在这一条里高亮出来的处数，用于列表顶部的合计。 */
  occurrences: number;
  /** 文章的分类名，其余为 null。 */
  category: string | null;
  /** 文章的标签名。 */
  tags: Array<string>;
  /** 文章与相册的 slug，其余为 null。 */
  slug: string | null;
  /** 友链的外站地址，其余为 null。 */
  href: string | null;
  publishedAt: string | null;
};
