import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { PublicCategorySchema } from "@/features/categories/categories.schema";
import { TagSelectSchema } from "@/features/tags/tags.schema";
import type { PostStatus } from "@/lib/db/schema";
import { PostsTable } from "@/lib/db/schema";
import { NullableJsonContentSchema } from "./json-content.schema";

// Date fields need to accept both Date objects and ISO strings (for JSON serialization)
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);
const coercedDateNullable = coercedDate.nullable();

const PublicPostCoverSchema = z.object({
  key: z.string(),
  url: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});

const AdminPostCoverSchema = PublicPostCoverSchema.extend({
  id: z.number().int(),
  fileName: z.string(),
});

const PublicSlugSchema = z
  .string()
  .nullable()
  .describe(
    "Slug of the live page at /post/{publicSlug}. It can differ from slug, the draft's, until the next publish. Null while the post is not published.",
  );

const PostSelectSchema = createSelectSchema(PostsTable, {
  publishedAt: coercedDateNullable,
  pinnedAt: coercedDateNullable,
  createdAt: coercedDate,
  updatedAt: coercedDate,
}).omit({
  publicSnapshotJson: true,
  // Never leaves the server; the editor only learns whether one is set.
  accessPasswordHash: true,
});
/**
 * Strict on purpose, and narrower than the table.
 *
 * `createUpdateSchema` takes every column, so `id`, `createdAt` and
 * `updatedAt` were writable: a PATCH could move a row to another id or
 * backdate it, and `updatedAt` is the default list sort key, so a forged
 * value buried the post. They are the server's to set, never the client's.
 *
 * Publication is not a field either. A plain object would silently strip
 * these: a client that PATCHed `{ status: "published" }` got a 200 back and a
 * post that was still a draft. Rejecting the key says so instead.
 */
const PostUpdateSchema = createUpdateSchema(PostsTable, {
  contentJson: NullableJsonContentSchema.optional(),
})
  .omit({
    publicSnapshotJson: true,
    publicSlug: true,
    status: true,
    id: true,
    createdAt: true,
    updatedAt: true,
    accessPasswordHash: true,
  })
  .extend({
    // Plain text on the wire; hashed before it is written.
    accessPassword: z.string().min(1).max(200).nullable().optional(),
  })
  .strict();

export const PostItemSchema = PostSelectSchema.omit({
  contentJson: true,
  publicSlug: true,
  coverMediaId: true,
  categoryId: true,
}).extend({
  tags: z.array(TagSelectSchema).optional(),
  category: PublicCategorySchema.nullable().catch(null),
  readTimeInMinutes: z.number().int().min(1),
  cover: PublicPostCoverSchema.nullable().catch(null),
});
export const PostListResponseSchema = z.object({
  items: z.array(PostItemSchema),
  nextCursor: z.number().nullable(),
});
export const HOME_POSTS_PER_PAGE = 8;
export const HomePostsInputSchema = z.object({
  page: z.number().int().min(1).max(1_000_000).default(1),
});
export const HomePostsResponseSchema = z.object({
  items: z.array(PostItemSchema),
  page: z.number().int().positive(),
  totalPages: z.number().int().positive(),
});
export const PostWithTocSchema = PostSelectSchema.omit({
  publicSlug: true,
  coverMediaId: true,
  categoryId: true,
})
  .extend({
    tags: z.array(TagSelectSchema).optional(),
    category: PublicCategorySchema.nullable().catch(null),
    readTimeInMinutes: z.number().int().min(1),
    toc: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        level: z.number(),
      }),
    ),
    cover: PublicPostCoverSchema.nullable().catch(null),
    locked: z
      .boolean()
      .describe(
        "True when the body needs a password. contentJson and toc are empty then.",
      ),
  })
  .nullable();

export const AdminPostSchema = PostSelectSchema.extend({
  publicSlug: PublicSlugSchema,
  tags: z.array(TagSelectSchema).optional(),
  hasPublicSnapshot: z.boolean(),
  hasAccessPassword: z.boolean(),
  publicSnapshotContentJson: NullableJsonContentSchema,
  serverToday: z.string(),
  cover: AdminPostCoverSchema.nullable(),
}).nullable();

export function normalizePostTagName(
  tagName: string | undefined,
): string | undefined {
  return tagName === "" ? undefined : tagName;
}

export function normalizePostCategoryName(
  categoryName: string | undefined,
): string | undefined {
  return categoryName === "" ? undefined : categoryName;
}

export const PostTagNameSchema = z
  .string()
  .transform(normalizePostTagName)
  .optional();

export const PostCategoryNameSchema = z
  .string()
  .transform(normalizePostCategoryName)
  .optional();

export const GetPostsCursorInputSchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().optional(),
  tagName: PostTagNameSchema,
  categoryName: PostCategoryNameSchema,
  uncategorized: z.boolean().optional(),
  excludePinned: z.boolean().optional(),
});

export const FindPostBySlugInputSchema = z.object({
  slug: z.string(),
});

const AdjacentPublicPostSchema = z.object({
  slug: z.string(),
  title: z.string(),
});

export const AdjacentPostsSchema = z.object({
  newer: AdjacentPublicPostSchema.nullable(),
  older: AdjacentPublicPostSchema.nullable(),
});

export type GetPostsCursorInput = z.infer<typeof GetPostsCursorInputSchema>;
export type FindPostBySlugInput = z.infer<typeof FindPostBySlugInputSchema>;

// Admin API Schemas
export const GenerateSlugInputSchema = z.object({
  title: z.string().optional(),
  excludeId: z.number().optional(),
});

export const GenerateSummaryInputSchema = z.object({
  contentJson: NullableJsonContentSchema,
});

export const GenerateSummaryOutputSchema = z.object({
  summary: z.string(),
});

const AdminTaxonomyFilterSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("category"),
    id: z.number().int().positive(),
    scope: z.enum(["current", "public"]),
  }),
  z.object({
    kind: z.literal("tag"),
    id: z.number().int().positive(),
    scope: z.enum(["current", "public"]),
  }),
  z.object({
    kind: z.literal("uncategorized"),
    scope: z.enum(["current", "public"]),
  }),
]);
export type AdminTaxonomyFilter = z.infer<typeof AdminTaxonomyFilterSchema>;

export const GetPostsInputSchema = z.object({
  taxonomy: AdminTaxonomyFilterSchema.optional(),
  categoryId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Only posts whose current category is this one."),
  uncategorized: z
    .boolean()
    .optional()
    .describe("Only posts without a current category."),
  tagId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Only posts currently carrying this tag."),
  offset: z.number().optional(),
  limit: z.number().optional(),
  status: z.custom<PostStatus>().optional(),
  publicOnly: z.boolean().optional(),
  search: z.string().optional(),
  sortDir: z.enum(["ASC", "DESC"]).optional(),
  sortBy: z.enum(["publishedAt", "updatedAt", "id"]).optional(),
  includeContent: z
    .boolean()
    .optional()
    .describe(
      "Include the editable TipTap body of every item. Ignored when taxonomy.scope is public, where every column is read from the Public Content Snapshot instead. Pagination, the 50 item limit and every other response field stay the same.",
    ),
});

const GetPostsCountInputSchema = GetPostsInputSchema.omit({
  offset: true,
  limit: true,
  sortDir: true,
  includeContent: true,
});

const AdminPostListItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  summary: z.string().nullable(),
  slug: z.string(),
  publicSlug: PublicSlugSchema,
  status: z.enum(["draft", "published"]),
  visibility: z.enum(["public", "password"]),
  privacyProtected: z.boolean(),
  publishedAt: coercedDateNullable,
  pinnedAt: coercedDateNullable,
  createdAt: coercedDate,
  updatedAt: coercedDate,
  contentJson: NullableJsonContentSchema.optional().describe(
    "Only returned when the request asks for includeContent=true outside the public taxonomy scope.",
  ),
});

const AdminPostStatusCountsSchema = z.object({
  draft: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
});
export type AdminPostStatusCounts = z.infer<typeof AdminPostStatusCountsSchema>;

export const AdminPostListPageSchema = z.object({
  items: z.array(AdminPostListItemSchema),
  total: z.number().int().nonnegative(),
  statusCounts: AdminPostStatusCountsSchema.describe(
    "Counts matching search, publicOnly, taxonomy scope and the category and tag filters before status filtering or pagination.",
  ),
});

export const FindPostByIdInputSchema = z.object({ id: z.number() });

/**
 * Content for a newly created draft. When present, `POST /api/admin/posts`
 * always creates a new draft instead of reusing an existing empty one, so
 * several external clients can create posts without colliding.
 */
const CreatePostDataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .describe("Draft title; a unique slug is generated from it."),
  summary: z.string().nullable().optional(),
  contentJson: NullableJsonContentSchema.optional(),
});

export const CreatePostInputSchema = z
  .object({
    data: CreatePostDataSchema.optional().describe(
      "Omit to keep the get-or-create-empty-draft behavior used by the Admin UI.",
    ),
  })
  .optional();

export const UpdatePostInputSchema = z.object({
  id: z.number(),
  data: PostUpdateSchema,
});

export const DeletePostInputSchema = z.object({ id: z.number() });

export const PublishPostInputSchema = z.object({
  id: z.number(),
});

export const UnpublishPostInputSchema = z.object({
  id: z.number(),
});

export type GenerateSlugInput = z.infer<typeof GenerateSlugInputSchema>;
export type GenerateSummaryInput = z.infer<typeof GenerateSummaryInputSchema>;
export type GetPostsInput = z.infer<typeof GetPostsInputSchema>;
export type GetPostsCountInput = z.infer<typeof GetPostsCountInputSchema>;
export type FindPostByIdInput = z.infer<typeof FindPostByIdInputSchema>;
export type CreatePostData = z.infer<typeof CreatePostDataSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;
export type DeletePostInput = z.infer<typeof DeletePostInputSchema>;
export type PublishPostInput = z.infer<typeof PublishPostInputSchema>;
export type UnpublishPostInput = z.infer<typeof UnpublishPostInputSchema>;
export type PostItem = z.infer<typeof PostItemSchema>;
export type PostWithToc = z.infer<typeof PostWithTocSchema>;

export const VideoMetaInputSchema = z.object({
  provider: z.enum(["bilibili", "youtube"]),
  videoId: z.string().max(32),
  page: z.number().int().positive().nullable().optional(),
});

export const VideoMetaSchema = z
  .object({
    title: z.string().nullable(),
    cover: z.string().nullable(),
    duration: z.number().int().nullable(),
  })
  .nullable();
