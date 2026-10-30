import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import {
  FriendLinksTable,
  GalleryCategoriesTable,
  MomentsTable,
} from "@/lib/db/schema";
import {
  SearchDocumentsTable,
  SearchIndexMetaTable,
} from "@/lib/db/schema/search.table";

export type SearchDocumentFields = {
  postId: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  tags: string[];
};

/** 写入索引时带分词结果。 */
export type SearchDocumentRow = SearchDocumentFields & { tokens: string };

/** 查询索引时额外带上文章发布时间和分类。 */
export type SearchDocumentMatch = SearchDocumentFields & {
  publishedAt: Date | null;
  category: string | null;
};

export async function upsertSearchDocument(
  db: DB,
  document: SearchDocumentRow & { tokens: string },
) {
  await db
    .insert(SearchDocumentsTable)
    .values({
      postId: document.postId,
      slug: document.slug,
      title: document.title,
      summary: document.summary,
      content: document.content,
      tags: document.tags,
      tokens: document.tokens,
    })
    .onConflictDoUpdate({
      target: SearchDocumentsTable.postId,
      set: {
        slug: document.slug,
        title: document.title,
        summary: document.summary,
        content: document.content,
        tags: document.tags,
        tokens: document.tokens,
      },
    });
  await bumpSearchIndexVersion(db);
}

export async function deleteSearchDocument(db: DB, postId: number) {
  await db
    .delete(SearchDocumentsTable)
    .where(eq(SearchDocumentsTable.postId, postId));
  await bumpSearchIndexVersion(db);
}

const INSERT_BATCH = 10;

export async function replaceSearchDocuments(
  db: DB,
  documents: Array<SearchDocumentRow & { tokens: string }>,
) {
  await db.delete(SearchDocumentsTable);
  for (let i = 0; i < documents.length; i += INSERT_BATCH) {
    await db
      .insert(SearchDocumentsTable)
      .values(documents.slice(i, i + INSERT_BATCH));
  }
  await bumpSearchIndexVersion(db);
}

export async function matchSearchDocuments(
  env: Env,
  match: string,
  limit: number,
  includeLocked = false,
): Promise<SearchDocumentMatch[]> {
  // 加密文章的正文同样在索引里，但只有管理员能把它查出来。
  const visibilityFilter = includeLocked
    ? ""
    : " AND p.visibility <> 'password'";
  const result = await env.DB.prepare(
    `SELECT d.post_id AS postId, d.slug, d.title, d.summary, d.content, d.tags,
            p.published_at AS publishedAt, c.name AS category
     FROM search_documents_fts
     JOIN search_documents d ON d.post_id = search_documents_fts.rowid
     JOIN posts p ON p.id = d.post_id${visibilityFilter}
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE search_documents_fts MATCH ?
     ORDER BY rank
     LIMIT ?`,
  )
    .bind(match, limit)
    .all<{
      postId: number;
      slug: string;
      title: string;
      summary: string;
      content: string;
      tags: string;
      publishedAt: number | null;
      category: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    postId: row.postId,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    tags: parseTags(row.tags),
    publishedAt:
      row.publishedAt === null ? null : new Date(row.publishedAt * 1000),
    category: row.category ?? null,
  }));
}

export async function readSearchIndexVersion(db: DB) {
  const [row] = await db
    .select({ version: SearchIndexMetaTable.version })
    .from(SearchIndexMetaTable)
    .where(eq(SearchIndexMetaTable.id, 1))
    .limit(1);
  return row?.version ?? "0";
}

async function bumpSearchIndexVersion(db: DB) {
  const version = Date.now().toString();
  await db
    .insert(SearchIndexMetaTable)
    .values({ id: 1, version })
    .onConflictDoUpdate({
      target: SearchIndexMetaTable.id,
      set: { version },
    });
}

function parseTags(raw: string) {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed;
    }
  } catch {}
  return [];
}

/** LIKE 里的 % _ \ 要转义，否则用户输入会被当成通配符。 */
function escapeLike(term: string) {
  return term.replace(/[%_\\]/g, "\\$&");
}

function likeAnyColumn(column: SQLWrapper, pattern: string) {
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

function likePattern(term: string) {
  return `%${escapeLike(term)}%`;
}

/** 每条记录都要命中全部关键词。 */
function allTermsMatch(terms: Array<string>, build: (p: string) => SQL) {
  return terms.map((term) => build(likePattern(term)));
}

export type MomentSearchRow = {
  id: number;
  body: string;
  publishedAt: Date | null;
};

/** 日常：搜正文；上锁的只有管理员能搜到。 */
export async function matchMoments(
  db: DB,
  terms: Array<string>,
  limit: number,
  includeLocked = false,
): Promise<Array<MomentSearchRow>> {
  if (terms.length === 0) return [];
  const conditions = allTermsMatch(terms, (pattern) =>
    likeAnyColumn(MomentsTable.body, pattern),
  );

  const rows = await db
    .select({
      id: MomentsTable.id,
      body: MomentsTable.body,
      publishedAt: MomentsTable.publishedAt,
    })
    .from(MomentsTable)
    .where(
      and(
        isNotNull(MomentsTable.publishedAt),
        includeLocked ? undefined : isNull(MomentsTable.accessPasswordHash),
        ...conditions,
      ),
    )
    .orderBy(desc(MomentsTable.publishedAt), desc(MomentsTable.id))
    .limit(limit);

  return rows;
}

export type GallerySearchRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  publishedAt: Date | null;
};

/** 相册集：完全隐藏或上锁的，只有管理员能搜到。 */
export async function matchGalleryCategories(
  db: DB,
  terms: Array<string>,
  limit: number,
  includeLocked = false,
): Promise<Array<GallerySearchRow>> {
  if (terms.length === 0) return [];
  const conditions = allTermsMatch(
    terms,
    (pattern) =>
      sql`(${likeAnyColumn(GalleryCategoriesTable.name, pattern)} or coalesce(${GalleryCategoriesTable.description}, '') LIKE ${pattern} ESCAPE '\\')`,
  );

  const rows = await db
    .select({
      id: GalleryCategoriesTable.id,
      name: GalleryCategoriesTable.name,
      slug: GalleryCategoriesTable.slug,
      description: GalleryCategoriesTable.description,
      publishedAt: GalleryCategoriesTable.publishedAt,
    })
    .from(GalleryCategoriesTable)
    .where(
      and(
        isNotNull(GalleryCategoriesTable.publishedAt),
        includeLocked
          ? undefined
          : eq(GalleryCategoriesTable.privacyProtected, false),
        includeLocked
          ? undefined
          : isNull(GalleryCategoriesTable.accessPasswordHash),
        ...conditions,
      ),
    )
    .orderBy(GalleryCategoriesTable.sortOrder, GalleryCategoriesTable.id)
    .limit(limit);

  return rows;
}

export type FriendLinkSearchRow = {
  id: number;
  siteName: string;
  siteUrl: string;
  description: string | null;
  createdAt: Date | null;
};

/** 友链：只搜已通过的站点。 */
export async function matchFriendLinks(
  db: DB,
  terms: Array<string>,
  limit: number,
): Promise<Array<FriendLinkSearchRow>> {
  if (terms.length === 0) return [];
  const conditions = allTermsMatch(
    terms,
    (pattern) =>
      sql`(${likeAnyColumn(FriendLinksTable.siteName, pattern)} or coalesce(${FriendLinksTable.description}, '') LIKE ${pattern} ESCAPE '\\' or ${likeAnyColumn(FriendLinksTable.siteUrl, pattern)})`,
  );

  const rows = await db
    .select({
      id: FriendLinksTable.id,
      siteName: FriendLinksTable.siteName,
      siteUrl: FriendLinksTable.siteUrl,
      description: FriendLinksTable.description,
      createdAt: FriendLinksTable.createdAt,
    })
    .from(FriendLinksTable)
    .where(and(eq(FriendLinksTable.status, "approved"), ...conditions))
    .orderBy(desc(FriendLinksTable.createdAt), desc(FriendLinksTable.id))
    .limit(limit);

  return rows;
}
