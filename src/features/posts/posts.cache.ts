import { defineEntry } from "@/features/cache/public-cache";
import * as PostRepo from "@/features/posts/data/posts.data";
import {
  PostItemSchema,
  HomePostsResponseSchema,
  PostListResponseSchema,
  PostWithTocSchema,
} from "@/features/posts/schema/posts.schema";
import { toPublicCover } from "@/features/posts/public-snapshot";
import { estimateReadTimeMinutes } from "@/features/posts/utils/content";
import { generateTableOfContents } from "@/features/posts/utils/toc";

const POST_PUBLIC_REASONS = [
  "post.published",
  "post.deleted",
  "tag.changed",
  "category.changed",
] as const;

export const homePosts = defineEntry({
  name: "posts.home",
  namespace: "posts:home",
  key: ({ page }: { page: number }) => ["posts", "home", page],
  schema: HomePostsResponseSchema,
  ttl: "7d",
  invalidatedBy: POST_PUBLIC_REASONS,
  load: (context, { page }) => PostRepo.getHomePosts(context.db, page),
});

export const pinnedPosts = defineEntry({
  name: "posts.pinned",
  namespace: "posts:pinned",
  key: (_params: Record<string, never>) => ["posts", "pinned"],
  schema: PostItemSchema.array(),
  ttl: "7d",
  invalidatedBy: POST_PUBLIC_REASONS,
  load: (context) => PostRepo.findPinnedPosts(context.db),
});

export const postsList = defineEntry({
  name: "posts.list",
  namespace: "posts:list",
  address: ["limit", "cursor"],
  key: ({
    limit,
    cursor,
    tagName,
    categoryName,
    uncategorized,
  }: {
    limit: number;
    cursor: number;
    tagName?: string;
    categoryName?: string;
    uncategorized?: boolean;
    excludePinned?: boolean;
  }) => [
    "posts",
    "list",
    limit,
    cursor,
    tagName ?? "all-tags",
    uncategorized ? "uncategorized" : (categoryName ?? "all-categories"),
  ],
  schema: PostListResponseSchema,
  ttl: "7d",
  invalidatedBy: POST_PUBLIC_REASONS,
  load: (
    context,
    { limit, cursor, tagName, categoryName, uncategorized, excludePinned },
  ) =>
    PostRepo.getPostsCursor(context.db, {
      cursor,
      limit,
      publicOnly: true,
      tagName,
      categoryName,
      uncategorized,
      excludePinned,
    }),
});

export const postBySlug = defineEntry({
  name: "posts.detail",
  namespace: "posts:detail",
  address: ["slug"],
  key: ({ slug }: { slug: string }) => ["post", slug],
  schema: PostWithTocSchema,
  ttl: "7d",
  invalidatedBy: POST_PUBLIC_REASONS,
  load: async (context, { slug }) => {
    const post = await PostRepo.findPostBySlug(context.db, slug, {
      publicOnly: true,
    });
    if (!post) return null;

    return {
      id: post.id,
      title: post.title,
      summary: post.summary,
      slug: post.slug,
      status: "published" as const,
      visibility: post.visibility,
      publishedAt: post.publishedAt,
      pinnedAt: post.pinnedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      contentJson: post.contentJson,
      readTimeInMinutes: estimateReadTimeMinutes(post.contentJson),
      tags: post.tags,
      category: "category" in post ? (post.category ?? null) : null,
      toc: generateTableOfContents(post.contentJson),
      cover: toPublicCover(post.publicSnapshotJson?.cover),
      // Locking is decided per request in the router, never cached.
      locked: false,
    };
  },
});
