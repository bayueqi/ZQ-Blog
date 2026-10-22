import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { keepUpdatedAt } from "@/features/comments/data/comments.data";
import {
  CommentsTable,
  GalleryCategoriesTable,
  GalleryPhotosTable,
  PostRevisionsTable,
  PostsTable,
  user as UserTable,
} from "@/lib/db/schema";

const postSummaryColumns = {
  id: PostsTable.id,
  title: PostsTable.title,
  status: PostsTable.status,
  pinnedAt: PostsTable.pinnedAt,
  updatedAt: PostsTable.updatedAt,
};

const publicPostTitle = sql<string>`coalesce(json_extract(${PostsTable.publicSnapshotJson}, '$.title'), ${PostsTable.title})`;

const postIsPublic = and(
  isNotNull(PostsTable.publicSnapshotJson),
  isNotNull(PostsTable.publicSlug),
);

export async function listRecentPosts(db: DB, limit: number) {
  return db
    .select(postSummaryColumns)
    .from(PostsTable)
    .orderBy(desc(PostsTable.updatedAt), desc(PostsTable.id))
    .limit(limit);
}

export async function findLatestDraft(db: DB) {
  const [draft] = await db
    .select(postSummaryColumns)
    .from(PostsTable)
    .where(eq(PostsTable.status, "draft"))
    .orderBy(desc(PostsTable.updatedAt), desc(PostsTable.id))
    .limit(1);
  return draft ?? null;
}

/** How many Gallery categories there are, and how many photos inside them. */
export async function countGalleryAssets(db: DB) {
  const [categories, photos] = await Promise.all([
    db.select({ total: count() }).from(GalleryCategoriesTable),
    db.select({ total: count() }).from(GalleryPhotosTable),
  ]);
  return {
    galleries: categories[0]?.total ?? 0,
    galleryPhotos: photos[0]?.total ?? 0,
  };
}

/** Published Comments on public Posts, in total and since `since`. */
export async function countPublicComments(db: DB, since: Date) {
  const [row] = await db
    .select({
      total: count(),
      recent: sql<number>`coalesce(sum(case when ${CommentsTable.createdAt} >= ${Math.floor(since.getTime() / 1000)} then 1 else 0 end), 0)`,
    })
    .from(CommentsTable)
    .innerJoin(PostsTable, eq(CommentsTable.postId, PostsTable.id))
    .where(and(eq(CommentsTable.status, "published"), postIsPublic));
  return { total: row?.total ?? 0, recent: Number(row?.recent ?? 0) };
}

const AdminReply = alias(CommentsTable, "admin_reply");
const AdminReplyAuthor = alias(UserTable, "admin_reply_author");

/**
 * A published Comment by a visitor on a public Post that no Admin has
 * handled (replied to or marked handled) and no published Admin Comment
 * answers: none replies to it, and for a root Comment none sits in its
 * thread without a reply target (rows written before reply targets).
 */
function unrepliedVisitorComment(db: DB) {
  return and(
    eq(CommentsTable.status, "published"),
    isNull(CommentsTable.handledAt),
    postIsPublic,
    or(isNull(UserTable.role), ne(UserTable.role, "admin")),
    notExists(
      db
        .select({ id: AdminReply.id })
        .from(AdminReply)
        .innerJoin(AdminReplyAuthor, eq(AdminReply.userId, AdminReplyAuthor.id))
        .where(
          and(
            eq(AdminReply.postId, CommentsTable.postId),
            eq(AdminReply.status, "published"),
            eq(AdminReplyAuthor.role, "admin"),
            or(
              eq(AdminReply.replyToCommentId, CommentsTable.id),
              and(
                isNull(CommentsTable.rootId),
                isNull(AdminReply.replyToCommentId),
                eq(AdminReply.rootId, CommentsTable.id),
              ),
            ),
          ),
        ),
    ),
  );
}

/**
 * Unreplied Comments, newest first; `beforeId` continues after that Comment,
 * so a page stays put while Comments above it leave the list.
 */
export async function listUnrepliedComments(
  db: DB,
  options: { limit: number; beforeId?: number },
) {
  let after: SQL | undefined;
  if (options.beforeId !== undefined) {
    const [cursor] = await db
      .select({ createdAt: CommentsTable.createdAt })
      .from(CommentsTable)
      .where(eq(CommentsTable.id, options.beforeId))
      .limit(1);
    after = cursor
      ? or(
          lt(CommentsTable.createdAt, cursor.createdAt),
          and(
            eq(CommentsTable.createdAt, cursor.createdAt),
            lt(CommentsTable.id, options.beforeId),
          ),
        )
      : lt(CommentsTable.id, options.beforeId);
  }
  return db
    .select({
      id: CommentsTable.id,
      postId: CommentsTable.postId,
      rootId: CommentsTable.rootId,
      content: CommentsTable.content,
      createdAt: CommentsTable.createdAt,
      userId: CommentsTable.userId,
      userName: UserTable.name,
      userImage: UserTable.image,
      userMutedAt: UserTable.mutedAt,
      postTitle: publicPostTitle,
      postSlug: PostsTable.publicSlug,
    })
    .from(CommentsTable)
    .innerJoin(PostsTable, eq(CommentsTable.postId, PostsTable.id))
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id))
    .where(and(unrepliedVisitorComment(db), after))
    .orderBy(desc(CommentsTable.createdAt), desc(CommentsTable.id))
    .limit(options.limit);
}

export async function countUnrepliedComments(db: DB) {
  const [row] = await db
    .select({ total: count() })
    .from(CommentsTable)
    .innerJoin(PostsTable, eq(CommentsTable.postId, PostsTable.id))
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id))
    .where(unrepliedVisitorComment(db));
  return row?.total ?? 0;
}

/** Marks every unreplied Comment handled; returns how many there were. */
export async function markUnrepliedCommentsHandled(db: DB, handledAt: Date) {
  const unreplied = db
    .select({ id: CommentsTable.id })
    .from(CommentsTable)
    .innerJoin(PostsTable, eq(CommentsTable.postId, PostsTable.id))
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id))
    .where(unrepliedVisitorComment(db));
  const marked = await db
    .update(CommentsTable)
    .set({ handledAt, ...keepUpdatedAt })
    .where(inArray(CommentsTable.id, unreplied))
    .returning({ id: CommentsTable.id });
  return marked.length;
}

/**
 * Writing events since `since`, counted per UTC hour (hours since the Unix
 * epoch): Post revisions (autosaves kept, publishes, restore backups) and
 * Posts created. Hours, not days, so the reader can group them by its own
 * local day.
 */
export async function countWritingEventsByHour(db: DB, since: Date) {
  const revisionHour = sql<number>`${PostRevisionsTable.createdAt} / 3600`;
  const postHour = sql<number>`${PostsTable.createdAt} / 3600`;
  const [revisions, posts] = await Promise.all([
    db
      .select({ hour: revisionHour, count: count() })
      .from(PostRevisionsTable)
      .where(gte(PostRevisionsTable.createdAt, since))
      .groupBy(revisionHour),
    db
      .select({ hour: postHour, count: count() })
      .from(PostsTable)
      .where(gte(PostsTable.createdAt, since))
      .groupBy(postHour),
  ]);
  const byHour = new Map<number, number>();
  for (const row of [...revisions, ...posts]) {
    const hour = Number(row.hour);
    byHour.set(hour, (byHour.get(hour) ?? 0) + row.count);
  }
  return [...byHour]
    .sort(([a], [b]) => a - b)
    .map(([hour, events]) => ({ hour, count: events }));
}
