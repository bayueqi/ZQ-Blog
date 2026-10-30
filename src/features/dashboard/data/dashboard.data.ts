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
  MediaTable,
  MomentsTable,
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

/**
 * A Comment hangs on a Post, a Moment or a Gallery Category, so every query
 * about Comments joins all three on `target_type` and picks the matching one.
 * `targetIsOpen` drops targets a reader could not open: unpublished Posts,
 * password-locked or privacy-protected content.
 */
const targetIsOpen = or(
  and(eq(CommentsTable.targetType, "post"), postIsPublic),
  and(
    eq(CommentsTable.targetType, "moment"),
    isNotNull(MomentsTable.publishedAt),
    isNull(MomentsTable.accessPasswordHash),
  ),
  and(
    eq(CommentsTable.targetType, "gallery"),
    eq(GalleryCategoriesTable.privacyProtected, false),
    isNull(GalleryCategoriesTable.accessPasswordHash),
  ),
);

/** What the Comment sits under, for the moderation list. */
const targetTitle = sql<string>`coalesce(
  case when ${CommentsTable.targetType} = 'post' then ${publicPostTitle} end,
  case when ${CommentsTable.targetType} = 'moment' then substr(${MomentsTable.body}, 1, 40) end,
  case when ${CommentsTable.targetType} = 'gallery' then ${GalleryCategoriesTable.name} end,
  ''
)`;

/** Slug of the Post or Gallery a Comment hangs on; Moments need none. */
const targetSlug = sql<string | null>`case
  when ${CommentsTable.targetType} = 'post' then ${PostsTable.publicSlug}
  when ${CommentsTable.targetType} = 'gallery' then ${GalleryCategoriesTable.slug}
end`;

export async function findLatestDraft(db: DB) {
  const [draft] = await db
    .select(postSummaryColumns)
    .from(PostsTable)
    .where(eq(PostsTable.status, "draft"))
    .orderBy(desc(PostsTable.updatedAt), desc(PostsTable.id))
    .limit(1);
  return draft ?? null;
}

/** 最近改动的文章、相册、日常，三种内容混在一起按时间倒序。 */
export interface RecentEditRow {
  kind: "post" | "gallery" | "moment";
  id: number;
  title: string;
  published: boolean;
  pinnedAt: Date | null;
  updatedAt: Date;
}

export async function listRecentEdits(
  db: DB,
  limit: number,
): Promise<Array<RecentEditRow>> {
  const [posts, galleries, moments] = await Promise.all([
    db
      .select(postSummaryColumns)
      .from(PostsTable)
      .orderBy(desc(PostsTable.updatedAt), desc(PostsTable.id))
      .limit(limit),
    db
      .select({
        id: GalleryCategoriesTable.id,
        name: GalleryCategoriesTable.name,
        publishedAt: GalleryCategoriesTable.publishedAt,
        pinnedAt: GalleryCategoriesTable.pinnedAt,
        updatedAt: GalleryCategoriesTable.updatedAt,
      })
      .from(GalleryCategoriesTable)
      .orderBy(
        desc(GalleryCategoriesTable.updatedAt),
        desc(GalleryCategoriesTable.id),
      )
      .limit(limit),
    db
      .select({
        id: MomentsTable.id,
        body: MomentsTable.body,
        publishedAt: MomentsTable.publishedAt,
        pinnedAt: MomentsTable.pinnedAt,
        updatedAt: MomentsTable.updatedAt,
      })
      .from(MomentsTable)
      .orderBy(desc(MomentsTable.updatedAt), desc(MomentsTable.id))
      .limit(limit),
  ]);

  const edits: Array<RecentEditRow> = [
    ...posts.map((post) => ({
      kind: "post" as const,
      id: post.id,
      title: post.title,
      published: post.status === "published",
      pinnedAt: post.pinnedAt,
      updatedAt: post.updatedAt,
    })),
    ...galleries.map((category) => ({
      kind: "gallery" as const,
      id: category.id,
      title: category.name,
      published: category.publishedAt !== null,
      pinnedAt: category.pinnedAt,
      updatedAt: category.updatedAt,
    })),
    ...moments.map((moment) => ({
      kind: "moment" as const,
      id: moment.id,
      title: moment.body,
      published: moment.publishedAt !== null,
      pinnedAt: moment.pinnedAt,
      updatedAt: moment.updatedAt,
    })),
  ];

  return edits
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

/** 日常：已发布的多少条，还没发布的（草稿）多少条。 */
export async function countMoments(db: DB) {
  const [row] = await db
    .select({
      published: sql<number>`coalesce(sum(case when ${MomentsTable.publishedAt} is not null then 1 else 0 end), 0)`,
      draft: sql<number>`coalesce(sum(case when ${MomentsTable.publishedAt} is null then 1 else 0 end), 0)`,
    })
    .from(MomentsTable);

  return { published: row?.published ?? 0, draft: row?.draft ?? 0 };
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

/** Every file the media library holds, in total and since `since`. */
export async function countMediaAssets(db: DB, since: Date) {
  const [row] = await db
    .select({
      total: count(),
      recent: sql<number>`coalesce(sum(case when ${MediaTable.createdAt} >= ${Math.floor(since.getTime() / 1000)} then 1 else 0 end), 0)`,
    })
    .from(MediaTable);
  return {
    mediaAssets: row?.total ?? 0,
    recentMediaAssets: Number(row?.recent ?? 0),
  };
}

/** Published Comments on content a reader can open, in total and since `since`. */
export async function countPublicComments(db: DB, since: Date) {
  const [row] = await db
    .select({
      total: count(),
      recent: sql<number>`coalesce(sum(case when ${CommentsTable.createdAt} >= ${Math.floor(since.getTime() / 1000)} then 1 else 0 end), 0)`,
    })
    .from(CommentsTable)
    .leftJoin(
      PostsTable,
      and(
        eq(CommentsTable.targetType, "post"),
        eq(CommentsTable.targetId, PostsTable.id),
      ),
    )
    .leftJoin(
      MomentsTable,
      and(
        eq(CommentsTable.targetType, "moment"),
        eq(CommentsTable.targetId, MomentsTable.id),
      ),
    )
    .leftJoin(
      GalleryCategoriesTable,
      and(
        eq(CommentsTable.targetType, "gallery"),
        eq(CommentsTable.targetId, GalleryCategoriesTable.id),
      ),
    )
    .where(and(eq(CommentsTable.status, "published"), targetIsOpen));
  return { total: row?.total ?? 0, recent: Number(row?.recent ?? 0) };
}

const AdminReply = alias(CommentsTable, "admin_reply");
const AdminReplyAuthor = alias(UserTable, "admin_reply_author");

/**
 * A published Comment by a visitor on content a reader can open that no Admin
 * has handled (replied to or marked handled) and no published Admin Comment
 * answers: none replies to it, and for a root Comment none sits in its
 * thread without a reply target (rows written before reply targets).
 */
function unrepliedVisitorComment(db: DB) {
  return and(
    eq(CommentsTable.status, "published"),
    isNull(CommentsTable.handledAt),
    targetIsOpen,
    or(isNull(UserTable.role), ne(UserTable.role, "admin")),
    notExists(
      db
        .select({ id: AdminReply.id })
        .from(AdminReply)
        .innerJoin(AdminReplyAuthor, eq(AdminReply.userId, AdminReplyAuthor.id))
        .where(
          and(
            eq(AdminReply.targetType, CommentsTable.targetType),
            eq(AdminReply.targetId, CommentsTable.targetId),
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
      targetType: CommentsTable.targetType,
      targetId: CommentsTable.targetId,
      rootId: CommentsTable.rootId,
      content: CommentsTable.content,
      createdAt: CommentsTable.createdAt,
      handledAt: CommentsTable.handledAt,
      userId: CommentsTable.userId,
      userName: UserTable.name,
      userImage: UserTable.image,
      userMutedAt: UserTable.mutedAt,
      targetTitle,
      targetSlug,
    })
    .from(CommentsTable)
    .leftJoin(
      PostsTable,
      and(
        eq(CommentsTable.targetType, "post"),
        eq(CommentsTable.targetId, PostsTable.id),
      ),
    )
    .leftJoin(
      MomentsTable,
      and(
        eq(CommentsTable.targetType, "moment"),
        eq(CommentsTable.targetId, MomentsTable.id),
      ),
    )
    .leftJoin(
      GalleryCategoriesTable,
      and(
        eq(CommentsTable.targetType, "gallery"),
        eq(CommentsTable.targetId, GalleryCategoriesTable.id),
      ),
    )
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id))
    .where(and(unrepliedVisitorComment(db), after))
    .orderBy(desc(CommentsTable.createdAt), desc(CommentsTable.id))
    .limit(options.limit);
}

export async function countUnrepliedComments(db: DB) {
  const [row] = await db
    .select({ total: count() })
    .from(CommentsTable)
    .leftJoin(
      PostsTable,
      and(
        eq(CommentsTable.targetType, "post"),
        eq(CommentsTable.targetId, PostsTable.id),
      ),
    )
    .leftJoin(
      MomentsTable,
      and(
        eq(CommentsTable.targetType, "moment"),
        eq(CommentsTable.targetId, MomentsTable.id),
      ),
    )
    .leftJoin(
      GalleryCategoriesTable,
      and(
        eq(CommentsTable.targetType, "gallery"),
        eq(CommentsTable.targetId, GalleryCategoriesTable.id),
      ),
    )
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id))
    .where(unrepliedVisitorComment(db));
  return row?.total ?? 0;
}

/** 评论管理页的四种口径：全部、已处理、待回复、我发的。 */
export type AdminCommentFilter = "all" | "replied" | "unreplied" | "mine";

/** 访客发在可打开内容上的评论；三种口径都从这个集合出发。 */
const visitorComment = and(
  eq(CommentsTable.status, "published"),
  targetIsOpen,
  or(isNull(UserTable.role), ne(UserTable.role, "admin")),
);

function adminCommentsQuery(db: DB) {
  return db
    .select({
      id: CommentsTable.id,
      targetType: CommentsTable.targetType,
      targetId: CommentsTable.targetId,
      rootId: CommentsTable.rootId,
      content: CommentsTable.content,
      createdAt: CommentsTable.createdAt,
      handledAt: CommentsTable.handledAt,
      userId: CommentsTable.userId,
      userName: UserTable.name,
      userImage: UserTable.image,
      userMutedAt: UserTable.mutedAt,
      targetTitle,
      targetSlug,
    })
    .from(CommentsTable)
    .leftJoin(
      PostsTable,
      and(
        eq(CommentsTable.targetType, "post"),
        eq(CommentsTable.targetId, PostsTable.id),
      ),
    )
    .leftJoin(
      MomentsTable,
      and(
        eq(CommentsTable.targetType, "moment"),
        eq(CommentsTable.targetId, MomentsTable.id),
      ),
    )
    .leftJoin(
      GalleryCategoriesTable,
      and(
        eq(CommentsTable.targetType, "gallery"),
        eq(CommentsTable.targetId, GalleryCategoriesTable.id),
      ),
    )
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id));
}

function adminCommentsCountQuery(db: DB) {
  return db
    .select({ total: count() })
    .from(CommentsTable)
    .leftJoin(
      PostsTable,
      and(
        eq(CommentsTable.targetType, "post"),
        eq(CommentsTable.targetId, PostsTable.id),
      ),
    )
    .leftJoin(
      MomentsTable,
      and(
        eq(CommentsTable.targetType, "moment"),
        eq(CommentsTable.targetId, MomentsTable.id),
      ),
    )
    .leftJoin(
      GalleryCategoriesTable,
      and(
        eq(CommentsTable.targetType, "gallery"),
        eq(CommentsTable.targetId, GalleryCategoriesTable.id),
      ),
    )
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id));
}

/**
 * `replied` 指管理员回复过或手动标记过已处理；`unreplied` 与概览同一口径；
 * `mine` 是当前管理员自己发的评论（含回复），不受访客身份的限制。
 */
function adminCommentScope(
  db: DB,
  filter: AdminCommentFilter,
  viewerId: string,
): SQL | undefined {
  if (filter === "unreplied") return unrepliedVisitorComment(db);
  if (filter === "replied") {
    return and(visitorComment, isNotNull(CommentsTable.handledAt));
  }
  if (filter === "mine") {
    return and(
      eq(CommentsTable.status, "published"),
      eq(CommentsTable.userId, viewerId),
    );
  }
  return visitorComment;
}

/** 评论管理页的一页，最新的在前。 */
export async function listAdminComments(
  db: DB,
  options: {
    filter: AdminCommentFilter;
    limit: number;
    offset: number;
    viewerId: string;
  },
) {
  return adminCommentsQuery(db)
    .where(adminCommentScope(db, options.filter, options.viewerId))
    .orderBy(desc(CommentsTable.createdAt), desc(CommentsTable.id))
    .limit(options.limit)
    .offset(options.offset);
}

export async function countAdminComments(
  db: DB,
  filter: AdminCommentFilter,
  viewerId: string,
) {
  const [row] = await adminCommentsCountQuery(db).where(
    adminCommentScope(db, filter, viewerId),
  );
  return row?.total ?? 0;
}

/** Marks every unreplied Comment handled; returns how many there were. */
export async function markUnrepliedCommentsHandled(db: DB, handledAt: Date) {
  const unreplied = db
    .select({ id: CommentsTable.id })
    .from(CommentsTable)
    .leftJoin(
      PostsTable,
      and(
        eq(CommentsTable.targetType, "post"),
        eq(CommentsTable.targetId, PostsTable.id),
      ),
    )
    .leftJoin(
      MomentsTable,
      and(
        eq(CommentsTable.targetType, "moment"),
        eq(CommentsTable.targetId, MomentsTable.id),
      ),
    )
    .leftJoin(
      GalleryCategoriesTable,
      and(
        eq(CommentsTable.targetType, "gallery"),
        eq(CommentsTable.targetId, GalleryCategoriesTable.id),
      ),
    )
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
 * epoch): Post revisions (autosaves kept, publishes, restore backups), Posts
 * created, and Moments created or edited afterwards. Hours, not days, so the
 * reader can group them by its own local day.
 */
export async function countWritingEventsByHour(db: DB, since: Date) {
  const revisionHour = sql<number>`${PostRevisionsTable.createdAt} / 3600`;
  const postHour = sql<number>`${PostsTable.createdAt} / 3600`;
  const momentCreatedHour = sql<number>`${MomentsTable.createdAt} / 3600`;
  const momentEditedHour = sql<number>`${MomentsTable.updatedAt} / 3600`;
  const [revisions, posts, createdMoments, editedMoments] = await Promise.all([
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
    db
      .select({ hour: momentCreatedHour, count: count() })
      .from(MomentsTable)
      .where(gte(MomentsTable.createdAt, since))
      .groupBy(momentCreatedHour),
    // 新建时两个时间戳相同，只算一次；改过才算一次编辑。
    db
      .select({ hour: momentEditedHour, count: count() })
      .from(MomentsTable)
      .where(
        and(
          gte(MomentsTable.updatedAt, since),
          ne(MomentsTable.updatedAt, MomentsTable.createdAt),
        ),
      )
      .groupBy(momentEditedHour),
  ]);
  const byHour = new Map<number, number>();
  for (const row of [
    ...revisions,
    ...posts,
    ...createdMoments,
    ...editedMoments,
  ]) {
    const hour = Number(row.hour);
    byHour.set(hour, (byHour.get(hour) ?? 0) + row.count);
  }
  return [...byHour]
    .sort(([a], [b]) => a - b)
    .map(([hour, events]) => ({ hour, count: events }));
}
