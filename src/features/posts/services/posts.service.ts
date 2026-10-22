import { invalidate } from "@/features/cache/public-cache";
import * as CategoryRepo from "@/features/categories/data/categories.data";
import * as MediaRepo from "@/features/media/data/media.data";
import { syncPostMedia } from "@/features/posts/data/post-media.data";
import * as PostRevisionRepo from "@/features/posts/data/post-revisions.data";
import * as PostRepo from "@/features/posts/data/posts.data";
import {
  pinnedPosts,
  homePosts,
  postBySlug,
  postsList,
} from "@/features/posts/posts.cache";
import type {
  CreatePostData,
  DeletePostInput,
  FindPostByIdInput,
  FindPostBySlugInput,
  GenerateSlugInput,
  GetPostsCountInput,
  GetPostsCursorInput,
  GetPostsInput,
  PublishPostInput,
  UnpublishPostInput,
  UpdatePostInput,
} from "@/features/posts/schema/posts.schema";
import {
  normalizePostCategoryName,
  normalizePostTagName,
} from "@/features/posts/schema/posts.schema";
import { toIsoOrNull } from "@/features/posts/public-snapshot";
import type { PublicPostCover } from "@/lib/db/schema";

import { slugify } from "@/features/posts/utils/content";
import { normalizePostContent } from "@/features/posts/utils/normalize-content";
import {
  hashPostPassword,
  postAccessCookieName,
  readCookie,
  verifyPostAccess,
} from "@/features/posts/utils/post-access";
import { serverEnv } from "@/lib/env/server.env";
import {
  isFuturePublishDate,
  serverUtcDateString,
} from "@/features/posts/utils/date";
import { calculatePostHash } from "@/features/posts/utils/sync";
import { generateTableOfContents } from "@/features/posts/utils/toc";
import * as SearchService from "@/features/search/service/search.service";
import type { PublicPostSnapshot } from "@/lib/db/schema";
import { err, ok } from "@/lib/errors";

function stripPublicSnapshot<
  T extends { publicSnapshotJson?: unknown; publicSlug?: unknown },
>(post: T): Omit<T, "publicSnapshotJson" | "publicSlug"> {
  const {
    publicSnapshotJson: _publicSnapshotJson,
    publicSlug: _publicSlug,
    ...rest
  } = post;
  return rest;
}

async function resolveSnapshotCover(
  db: DB,
  coverMediaId: number | null | undefined,
): Promise<PublicPostCover | null> {
  if (coverMediaId == null) return null;
  const media = await MediaRepo.findMediaById(db, coverMediaId);
  if (!media) return null;
  return {
    mediaId: media.id,
    key: media.key,
    url: media.url,
    width: media.width,
    height: media.height,
  };
}

function toAdminCover(
  media: NonNullable<Awaited<ReturnType<typeof MediaRepo.findMediaById>>>,
) {
  return {
    id: media.id,
    key: media.key,
    url: media.url,
    fileName: media.fileName,
    width: media.width,
    height: media.height,
  };
}

async function buildPublicSnapshot(
  db: DB,
  post: NonNullable<Awaited<ReturnType<typeof PostRepo.findPostById>>>,
  contentJson: PublicPostSnapshot["contentJson"],
): Promise<PublicPostSnapshot> {
  return {
    title: post.title,
    summary: post.summary,
    slug: post.slug,
    contentJson,
    tagIds: [...new Set(post.tags.map((tag) => tag.id))].sort((a, b) => a - b),
    categoryId: post.categoryId ?? null,
    publishedAt: toIsoOrNull(post.publishedAt) ?? new Date().toISOString(),
    pinnedAt: toIsoOrNull(post.pinnedAt),
    cover: await resolveSnapshotCover(db, post.coverMediaId),
  };
}

async function createPublishRevision(
  context: DbContext,
  post: NonNullable<Awaited<ReturnType<typeof PostRepo.findPostById>>>,
) {
  const tagIds = [...new Set(post.tags.map((tag) => tag.id))].sort(
    (a, b) => a - b,
  );
  const snapshotHash = await calculatePostHash({
    title: post.title,
    contentJson: post.contentJson,
    summary: post.summary,
    tagIds,
    slug: post.slug,
    publishedAt: post.publishedAt,
    pinnedAt: post.pinnedAt,
    coverMediaId: post.coverMediaId,
    categoryId: post.categoryId ?? null,
  });

  const latestPublish = await PostRevisionRepo.findLatestPostRevision(
    context.db,
    post.id,
    { reason: "publish" },
  );
  if (latestPublish?.snapshotHash === snapshotHash) {
    return;
  }

  await PostRevisionRepo.insertPostRevision(context.db, {
    postId: post.id,
    reason: "publish",
    snapshotHash,
    snapshotJson: {
      title: post.title,
      summary: post.summary,
      slug: post.slug,
      status: "published",
      publishedAt: toIsoOrNull(post.publishedAt),
      contentJson: post.contentJson,
      tagIds,
      categoryId: post.categoryId ?? null,
      coverMediaId: post.coverMediaId ?? null,
    },
  });
}

export function getHomePosts(
  context: DbContext & { executionCtx: ExecutionContext },
  page: number,
) {
  return homePosts.get(context, { page });
}

export async function getPinnedPosts(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  return pinnedPosts.get(context, {});
}

export async function getPostsCursor(
  context: DbContext & { executionCtx: ExecutionContext },
  data: GetPostsCursorInput,
) {
  const tagName = normalizePostTagName(data.tagName);
  const categoryName = normalizePostCategoryName(data.categoryName);
  return postsList.get(context, {
    limit: data.limit ?? 10,
    cursor: data.cursor ?? 0,
    tagName,
    categoryName,
    uncategorized: data.uncategorized,
    excludePinned: data.excludePinned,
  });
}

export async function findPostBySlug(
  context: DbContext & {
    executionCtx: ExecutionContext;
    headers?: Headers;
    env?: Env;
    session?: { user: { role?: string | null } } | null;
  },
  data: FindPostBySlugInput,
) {
  const post = await postBySlug.get(context, { slug: data.slug });
  if (!post || post.visibility !== "password") return post;

  const meta = await PostRepo.findPostAccessMetaById(context.db, post.id);
  if (!meta?.accessPasswordHash) return post;
  if (context.session?.user.role === "admin") return post;

  const unlocked =
    context.env && context.headers
      ? await verifyPostAccess(
          serverEnv(context.env).BETTER_AUTH_SECRET,
          post.id,
          meta.accessPasswordHash,
          readCookie(
            context.headers.get("cookie"),
            postAccessCookieName(post.id),
          ),
        )
      : false;
  if (unlocked) return post;

  // The body and its table of contents never reach the browser before unlock.
  return { ...post, contentJson: null, toc: [], locked: true };
}

export async function getAdjacentPosts(
  context: DbContext,
  data: FindPostBySlugInput,
) {
  return PostRepo.findAdjacentPublicPosts(context.db, data.slug);
}

export async function generateSlug(
  context: DbContext,
  data: GenerateSlugInput,
) {
  const baseSlug = slugify(data.title);
  // 1. 先查有没有完全一样的 (比如 'hello-world')
  const exactMatch = await PostRepo.slugExists(context.db, baseSlug, {
    excludeId: data.excludeId,
  });
  if (!exactMatch) {
    return { slug: baseSlug };
  }

  // 2. 既然 'hello-world' 被占了，那就查所有 'hello-world-%' 的
  const similarSlugs = await PostRepo.findSimilarSlugs(context.db, baseSlug, {
    excludeId: data.excludeId,
  });

  // 3. 在内存里找最大的数字后缀
  // 正则含义：匹配以 "-数字" 结尾的字符串，并捕获那个数字
  const regex = new RegExp(`^${baseSlug}-(\\d+)$`);

  let maxSuffix = 0;
  for (const slug of similarSlugs) {
    const match = slug.match(regex);
    if (match) {
      const number = parseInt(match[1], 10);
      if (number > maxSuffix) {
        maxSuffix = number;
      }
    }
  }

  // 4. 结果就是最大值 + 1
  return { slug: `${baseSlug}-${maxSuffix + 1}` };
}

const SLUG_CONFLICT_PATTERN = /UNIQUE constraint failed:\s*posts\.slug/i;
const SLUG_INSERT_ATTEMPTS = 5;
const SLUG_DERIVED_ATTEMPTS = 2;

function isSlugConflict(error: unknown) {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (SLUG_CONFLICT_PATTERN.test(current.message)) return true;
  }
  return false;
}

function randomSlugSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Inserts a draft, deriving its slug from the title and retrying when a
 * concurrent insert claimed that slug first.
 *
 * `generateSlug` reads the existing slugs before the row is written, so two
 * creates racing on the same title derive the same slug and one of them hits
 * the unique index. Retrying the derived slug clears a single straggler, but
 * a whole batch racing at once keeps re-deriving the same next suffix, so
 * after `SLUG_DERIVED_ATTEMPTS` the losers take a random suffix instead. Only
 * a contended batch ever sees one, so ordinary creates keep a readable slug.
 */
async function insertDraftWithGeneratedSlug(
  context: DbContext,
  title: string,
  values: Omit<Parameters<typeof PostRepo.insertPost>[1], "slug">,
) {
  for (let attempt = 1; ; attempt += 1) {
    const { slug } = await generateSlug(context, { title });
    const candidate =
      attempt <= SLUG_DERIVED_ATTEMPTS ? slug : `${slug}-${randomSlugSuffix()}`;
    try {
      return await PostRepo.insertPost(context.db, {
        ...values,
        slug: candidate,
      });
    } catch (error) {
      if (attempt >= SLUG_INSERT_ATTEMPTS || !isSlugConflict(error))
        throw error;
    }
  }
}

/**
 * Creates a brand new draft carrying the given content. Unlike
 * `createEmptyPost`, it never reuses an existing empty draft, so a client can
 * safely retry a failed create or create several posts in a row.
 */
export async function createDraft(context: DbContext, data: CreatePostData) {
  const post = await insertDraftWithGeneratedSlug(context, data.title, {
    title: data.title,
    summary: data.summary ?? null,
    status: "draft",
    contentJson: normalizePostContent(data.contentJson ?? null),
  });

  await syncPostMedia(context.db, post);

  return { id: post.id };
}

export async function createEmptyPost(context: DbContext) {
  try {
    const existing = await PostRepo.findReusableEmptyDraft(context.db);
    if (existing) {
      return { id: existing.id };
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "reuse_empty_draft_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  const post = await insertDraftWithGeneratedSlug(context, "", {
    title: "",
    summary: "",
    status: "draft",
    contentJson: null,
  });

  return { id: post.id };
}

export async function listAdminPostsPage(
  context: DbContext,
  data: GetPostsInput,
) {
  const [items, statusCounts] = await Promise.all([
    getPosts(context, data),
    PostRepo.getAdminPostStatusCounts(context.db, {
      publicOnly: data.publicOnly,
      search: data.search,
      taxonomy: data.taxonomy,
      categoryId: data.categoryId,
      uncategorized: data.uncategorized,
      tagId: data.tagId,
    }),
  ]);
  const total =
    data.status === "draft"
      ? statusCounts.draft
      : data.status === "published"
        ? statusCounts.published
        : data.status
          ? 0
          : statusCounts.draft + statusCounts.published;
  return { items, total, statusCounts };
}

export async function getPosts(context: DbContext, data: GetPostsInput) {
  return await PostRepo.getPosts(context.db, {
    offset: data.offset ?? 0,
    limit: data.limit ?? 10,
    status: data.status,
    publicOnly: data.publicOnly,
    search: data.search,
    taxonomy: data.taxonomy,
    categoryId: data.categoryId,
    uncategorized: data.uncategorized,
    tagId: data.tagId,
    sortDir: data.sortDir,
    sortBy: data.sortBy,
    includeContent: data.includeContent,
  });
}

export async function getPostsCount(
  context: DbContext,
  data: GetPostsCountInput,
) {
  return await PostRepo.getPostsCount(context.db, {
    status: data.status,
    publicOnly: data.publicOnly,
    search: data.search,
    taxonomy: data.taxonomy,
    categoryId: data.categoryId,
    uncategorized: data.uncategorized,
    tagId: data.tagId,
  });
}

export async function findPostBySlugAdmin(
  context: DbContext,
  data: FindPostBySlugInput,
) {
  const post = await PostRepo.findPostBySlug(context.db, data.slug, {
    publicOnly: false,
  });
  if (!post) return null;
  return {
    ...stripPublicSnapshot(post),
    toc: generateTableOfContents(post.contentJson),
  };
}

export async function findPostById(
  context: DbContext,
  data: FindPostByIdInput,
) {
  const post = await PostRepo.findPostById(context.db, data.id);
  if (!post) return null;

  const coverMedia =
    post.coverMediaId == null
      ? null
      : await MediaRepo.findMediaById(context.db, post.coverMediaId);

  return {
    ...stripPublicSnapshot(post),
    publicSlug: post.publicSlug,
    coverMediaId: coverMedia ? post.coverMediaId : null,
    cover: coverMedia ? toAdminCover(coverMedia) : null,
    hasPublicSnapshot: post.publicSnapshotJson != null,
    hasAccessPassword: post.accessPasswordHash != null,
    publicSnapshotContentJson: post.publicSnapshotJson?.contentJson ?? null,
    serverToday: serverUtcDateString(),
  };
}

export async function updatePost(
  context: DbContext & { executionCtx: ExecutionContext; env?: Env },
  data: UpdatePostInput,
) {
  if (data.data.coverMediaId != null) {
    const coverMedia = await MediaRepo.findMediaById(
      context.db,
      data.data.coverMediaId,
    );
    if (!coverMedia) {
      return err({ reason: "MEDIA_NOT_FOUND" });
    }
  }

  if (data.data.categoryId != null) {
    const category = await CategoryRepo.findCategoryById(
      context.db,
      data.data.categoryId,
    );
    if (!category) {
      return err({ reason: "CATEGORY_NOT_FOUND" });
    }
  }

  const { accessPassword, ...rest } = data.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (rest.contentJson !== undefined) {
    updateData.contentJson = normalizePostContent(rest.contentJson);
  }
  // null clears the password; undefined leaves the stored hash alone.
  if (accessPassword !== undefined) {
    updateData.accessPasswordHash =
      accessPassword === null ? null : await hashPostPassword(accessPassword);
  } else if (updateData.visibility === "public") {
    // A public post keeps no stale password around.
    updateData.accessPasswordHash = null;
  }

  if (updateData.visibility === "password") {
    const existing = await PostRepo.findPostAccessMetaById(context.db, data.id);
    const willHavePassword =
      updateData.accessPasswordHash !== undefined
        ? updateData.accessPasswordHash !== null
        : existing?.accessPasswordHash != null;
    if (!willHavePassword) {
      return err({ reason: "ACCESS_PASSWORD_REQUIRED" });
    }
  }
  const updatedPost = await PostRepo.updatePost(
    context.db,
    data.id,
    updateData as Parameters<typeof PostRepo.updatePost>[2],
  );
  if (!updatedPost) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  if (
    updateData.contentJson !== undefined ||
    updateData.coverMediaId !== undefined
  ) {
    await syncPostMedia(context.db, updatedPost);
  }

  if (updateData.categoryId !== undefined && updatedPost.publicSnapshotJson) {
    context.executionCtx.waitUntil(
      invalidate.categoryChanged(context, {
        slugs: [updatedPost.publicSnapshotJson.slug],
      }),
    );
  }

  if (
    updateData.visibility !== undefined ||
    updateData.accessPasswordHash !== undefined
  ) {
    const snapshot = updatedPost.publicSnapshotJson;
    if (snapshot && updatedPost.publicSlug) {
      // The cached detail carries visibility, so it has to go.
      context.executionCtx.waitUntil(
        invalidate.postPublished(context, { slug: updatedPost.publicSlug }),
      );
      context.executionCtx.waitUntil(
        updatedPost.visibility === "password"
          ? SearchService.deleteIndex(context, { id: updatedPost.id })
          : SearchService.upsert(context, {
              id: updatedPost.id,
              slug: snapshot.slug,
              title: snapshot.title,
              summary: snapshot.summary,
              contentJson: snapshot.contentJson,
              tags: updatedPost.tags.map((tag) => tag.name),
              category: updatedPost.category?.name ?? null,
            }),
      );
    }
  }

  const { accessPasswordHash, ...safePost } = stripPublicSnapshot(updatedPost);
  return ok({ ...safePost, hasAccessPassword: accessPasswordHash != null });
}

export async function deletePost(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeletePostInput,
) {
  const post = await PostRepo.findPostById(context.db, data.id);
  if (!post) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  await PostRepo.deletePost(context.db, data.id);

  const publicSlug = post.publicSlug ?? post.publicSnapshotJson?.slug;
  if (publicSlug) {
    await SearchService.deleteIndex(context, { id: data.id });
    await invalidate.postDeleted(context, { slug: publicSlug });
  }

  return ok({ success: true });
}

export async function publishPost(
  context: DbContext & { executionCtx: ExecutionContext },
  data: PublishPostInput,
) {
  const post = await PostRepo.findPostById(context.db, data.id);
  if (!post) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  let publishedPost = post;
  if (!publishedPost.publishedAt) {
    const now = new Date();
    const updated = await PostRepo.updatePost(context.db, post.id, {
      publishedAt: now,
    });
    if (!updated) {
      return err({ reason: "POST_NOT_FOUND" });
    }
    publishedPost = updated;
  } else if (isFuturePublishDate(publishedPost.publishedAt.toISOString())) {
    return err({ reason: "PUBLISHED_AT_IN_FUTURE" });
  }

  const slugTaken = await PostRepo.publicSlugExists(
    context.db,
    publishedPost.slug,
    { excludeId: publishedPost.id },
  );
  if (slugTaken) {
    return err({ reason: "PUBLIC_SLUG_TAKEN" });
  }

  const normalizedContent = normalizePostContent(publishedPost.contentJson);
  if (normalizedContent) {
    const updated = await PostRepo.updatePost(context.db, publishedPost.id, {
      contentJson: normalizedContent,
    });
    if (updated) {
      publishedPost = updated;
    }
  }

  await createPublishRevision(context, publishedPost);

  const { highlightSnapshotContent } =
    await import("@/features/posts/utils/highlight-code-blocks");
  const snapshotContent = await highlightSnapshotContent(
    publishedPost.contentJson,
    publishedPost.publicSnapshotJson?.contentJson,
  );
  const snapshot = await buildPublicSnapshot(
    context.db,
    publishedPost,
    snapshotContent,
  );
  const previousPublicSlug = publishedPost.publicSlug;
  const published = await PostRepo.writePublicSnapshot(
    context.db,
    publishedPost.id,
    snapshot,
  );
  if (!published) {
    return err({ reason: "POST_NOT_FOUND" });
  }
  await syncPostMedia(context.db, published);

  if (publishedPost.visibility === "password") {
    // Indexing it would put the locked body into search snippets.
    await SearchService.deleteIndex(context, { id: publishedPost.id });
  } else {
    await SearchService.upsert(context, {
      id: publishedPost.id,
      slug: snapshot.slug,
      title: snapshot.title,
      summary: snapshot.summary,
      contentJson: snapshotContent,
      tags: publishedPost.tags.map((tag) => tag.name),
      category: publishedPost.category?.name ?? null,
    });
  }

  if (previousPublicSlug && previousPublicSlug !== snapshot.slug) {
    await invalidate.postDeleted(context, { slug: previousPublicSlug });
  }
  await invalidate.postPublished(context, { slug: snapshot.slug });

  return ok({ success: true });
}

export async function unpublishPost(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UnpublishPostInput,
) {
  const post = await PostRepo.findPostById(context.db, data.id);
  if (!post) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  const publicSlug =
    post.publicSlug ?? post.publicSnapshotJson?.slug ?? post.slug;
  const unpublished = await PostRepo.clearPublicSnapshot(context.db, post.id);
  if (!unpublished) {
    return err({ reason: "POST_NOT_FOUND" });
  }
  await syncPostMedia(context.db, unpublished);
  await SearchService.deleteIndex(context, { id: post.id });
  await invalidate.postDeleted(context, { slug: publicSlug });

  return ok({ success: true });
}
