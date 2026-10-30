import { isNotNull } from "drizzle-orm";
import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import { convertToPlainText } from "@/features/posts/utils/content";
import * as SearchRepo from "@/features/search/data/search.data";
import {
  CONTENT_SLICE,
  SNIPPET_SLICE,
} from "@/features/search/search.constants";
import type {
  DeleteSearchDocInput,
  SearchHit,
  SearchQueryInput,
  UpsertSearchDocInput,
} from "@/features/search/search.schema";
import {
  queryTerms,
  toFtsMatchQuery,
  tokenizeForSearch,
} from "@/features/search/tokenize";
import {
  buildSnippet,
  buildSnippets,
} from "@/features/search/utils/search.utils";
import { PostsTable } from "@/lib/db/schema";

function toIndexedDocument(
  data: UpsertSearchDocInput,
): Parameters<typeof SearchRepo.upsertSearchDocument>[1] {
  const plain = convertToPlainText(data.contentJson ?? null);
  // 分类和标签只用于展示，不参与命中。
  const content =
    plain.length > CONTENT_SLICE ? plain.slice(0, CONTENT_SLICE) : plain;
  const summary =
    data.summary && data.summary.trim().length > 0
      ? data.summary
      : content.slice(0, SNIPPET_SLICE);
  // 发布日期按页面上的写法当普通文本一起索引，搜「2026」就能命中。
  const publishedAt = formatPublicPostDate(data.publishedAt, { locale: "zh" });

  return {
    postId: data.id,
    slug: data.slug,
    title: data.title,
    summary,
    content,
    tags: data.tags ?? [],
    tokens: tokenizeForSearch(
      data.title,
      summary,
      content,
      publishedAt === "-" ? undefined : publishedAt,
    ),
  };
}

/** 文章之外的来源各取几条，避免日常、相册把文章挤出第一屏。 */
const EXTRA_LIMIT = 6;

/** 摘要和正文都可能命中，两边的命中句子都留下来，重复的句子里再去掉。 */
function snippetText(summary: string, content: string) {
  const head = summary.trim();
  const body = content.trim();
  if (!head) return body;
  if (!body) return head;
  return `${head}\n${body}`;
}

/**
 * 列表上「共 N 处匹配」的数字：直接数最终高亮 HTML 里的 `<mark>`，
 * 与页面上真正标出来的处数完全一致，不会漏掉摘要或被去重的重复句子。
 */
function countHighlights(...htmls: Array<string | null | undefined>) {
  let total = 0;
  for (const html of htmls) {
    if (html) total += html.split("<mark>").length - 1;
  }
  return total;
}

async function searchPosts(
  context: DbContext,
  query: string,
  terms: Array<string>,
  limit: number,
  includeLocked: boolean,
): Promise<Array<SearchHit>> {
  const match = toFtsMatchQuery(query);
  if (!match) return [];

  const rows = await SearchRepo.matchSearchDocuments(
    context.env,
    match,
    limit,
    includeLocked,
  );

  return rows.map((row) => {
    const titleHtml = buildSnippet({
      text: row.title,
      terms,
      fallbackTerm: query,
    });
    const snippets = buildSnippets({
      // 只在命中词出现的地方取句子，摘要不整段塞进来。
      text: snippetText(row.summary, row.content),
      terms,
      fallbackTerm: query,
    });
    return {
      kind: "post" as const,
      id: row.postId,
      title: row.title,
      titleHtml,
      snippets,
      occurrences: countHighlights(
        titleHtml,
        ...snippets.map((line) => line.html),
      ),
      tags: row.tags,
      category: row.category,
      slug: row.slug,
      href: null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  });
}

export async function search(
  context: DbContext,
  data: SearchQueryInput,
  viewer: { isAdmin?: boolean } = {},
): Promise<Array<SearchHit>> {
  const query = data.q.trim();
  if (!query) return [];

  const terms = queryTerms(query);
  const limit = Math.min(data.limit, 25);
  // 上锁的内容只对管理员开放。
  const includeLocked = viewer.isAdmin === true;

  const [posts, moments, galleries, friendLinks] = await Promise.all([
    searchPosts(context, query, terms, limit, includeLocked),
    SearchRepo.matchMoments(context.db, terms, EXTRA_LIMIT, includeLocked),
    SearchRepo.matchGalleryCategories(
      context.db,
      terms,
      EXTRA_LIMIT,
      includeLocked,
    ),
    SearchRepo.matchFriendLinks(context.db, terms, EXTRA_LIMIT),
  ]);

  const momentHits: Array<SearchHit> = moments.map((row) => {
    const titleHtml = buildSnippet({
      text: row.body,
      terms,
      fallbackTerm: query,
      // 日常没有单独摘要，标题位置只给一句，避免整条太长。
      options: { maxWindows: 1, snippetSlice: 60 },
    });
    return {
      kind: "moment",
      id: row.id,
      title: row.body.replaceAll("\n", " ").slice(0, 60),
      titleHtml,
      snippets: [],
      occurrences: countHighlights(titleHtml),
      category: null,
      tags: [],
      slug: null,
      href: null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  });

  const galleryHits: Array<SearchHit> = galleries.map((row) => {
    const titleHtml = buildSnippet({
      text: row.name,
      terms,
      fallbackTerm: query,
    });
    const snippets = buildSnippets({
      text: row.description,
      terms,
      fallbackTerm: query,
    });
    return {
      kind: "gallery",
      id: row.id,
      title: row.name,
      titleHtml,
      snippets,
      occurrences: countHighlights(
        titleHtml,
        ...snippets.map((line) => line.html),
      ),
      category: null,
      tags: [],
      slug: row.slug,
      href: null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  });

  const friendLinkHits: Array<SearchHit> = friendLinks.map((row) => {
    const titleHtml = buildSnippet({
      text: row.siteName,
      terms,
      fallbackTerm: query,
    });
    const snippets = buildSnippets({
      text: row.description?.trim() ? row.description : row.siteUrl,
      terms,
      fallbackTerm: query,
    });
    return {
      kind: "friend-link",
      id: row.id,
      title: row.siteName,
      titleHtml,
      snippets,
      occurrences: countHighlights(
        titleHtml,
        ...snippets.map((line) => line.html),
      ),
      category: null,
      tags: [],
      slug: null,
      href: row.siteUrl,
      publishedAt: row.createdAt?.toISOString() ?? null,
    };
  });

  return [...posts, ...momentHits, ...galleryHits, ...friendLinkHits];
}

export async function upsert(
  context: { env: Env; db: DB },
  data: UpsertSearchDocInput,
) {
  await SearchRepo.upsertSearchDocument(context.db, toIndexedDocument(data));
  return { id: data.id };
}

export async function deleteIndex(
  context: { env: Env; db: DB },
  data: DeleteSearchDocInput,
) {
  await SearchRepo.deleteSearchDocument(context.db, data.id);
  return { id: data.id };
}

export async function rebuildIndex(context: DbContext) {
  const { db } = context;
  const start = Date.now();

  const posts = await db.query.PostsTable.findMany({
    // 加密文章的正文同样进索引，查询时再按访问者身份过滤。
    where: isNotNull(PostsTable.publicSnapshotJson),
    with: {
      category: true,
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  const documents = [];
  for (const post of posts) {
    const snapshot = post.publicSnapshotJson;
    if (!snapshot?.title || !snapshot.slug) continue;
    const tags = post.postTags.map((pt) => pt.tag.name);
    const categoryName = post.category?.name ?? null;

    documents.push(
      toIndexedDocument({
        id: post.id,
        slug: snapshot.slug,
        title: snapshot.title,
        summary: snapshot.summary,
        contentJson: snapshot.contentJson,
        tags,
        category: categoryName,
        publishedAt: post.publishedAt,
      }),
    );
  }

  await SearchRepo.replaceSearchDocuments(db, documents);

  const duration = Date.now() - start;
  console.log(`[search] Indexed ${documents.length} posts in ${duration}ms`);

  return { indexed: documents.length, duration };
}

export async function getIndexVersion(context: DbContext) {
  return { version: await SearchRepo.readSearchIndexVersion(context.db) };
}
