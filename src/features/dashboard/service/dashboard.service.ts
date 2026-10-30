import { publicCommentPath } from "@/features/comments/comment-url";
import { resolveSystemConfig } from "@/features/config/config.resolve";
import * as ConfigRepo from "@/features/config/data/config.data";
import * as DashboardRepo from "@/features/dashboard/data/dashboard.data";
import {
  adminEmailNeedsSetup,
  commentSnippet,
  DASHBOARD_PENDING_FRIEND_LINKS_LIMIT,
  DASHBOARD_RECENT_COMMENT_DAYS,
  DASHBOARD_RECENT_EDITS_LIMIT,
  DASHBOARD_UNREPLIED_COMMENTS_LIMIT,
  DASHBOARD_WRITING_LOOKBACK_DAYS,
  siteIdentityIsDefault,
} from "@/features/dashboard/dashboard";
import type {
  AdminCommentsInput,
  AdminCommentsPage,
  DashboardComment,
  DashboardOverview,
  UnrepliedCommentsInput,
} from "@/features/dashboard/dashboard.schema";
import * as FriendLinkRepo from "@/features/friend-links/data/friend-links.data";
import { isMuted } from "@/features/muted-users/muted-users";
import * as PostRepo from "@/features/posts/data/posts.data";
import { versionChecker } from "@/features/version/service/version.service";
import * as VisitRepo from "@/features/visits/data/visits.data";
import {
  buildVisitorStats,
  utcDay,
  VISIT_RANGE_DAYS,
} from "@/features/visits/visits";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_EDIT_TITLE_LENGTH = 40;

/** 日常没有标题，取正文开头当标题。 */
function momentTitle(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return "日常";
  return text.length > RECENT_EDIT_TITLE_LENGTH
    ? `${text.slice(0, RECENT_EDIT_TITLE_LENGTH)}…`
    : text;
}

export async function getDashboardOverview(
  context: DbContext,
): Promise<DashboardOverview> {
  const { db } = context;
  const now = Date.now();
  /** Comments and media share one "recent" window on the overview. */
  const recentSince = new Date(now - DASHBOARD_RECENT_COMMENT_DAYS * DAY_MS);
  const writingSince = new Date(now - DASHBOARD_WRITING_LOOKBACK_DAYS * DAY_MS);
  const visitorsSince = utcDay(new Date(now - (VISIT_RANGE_DAYS - 1) * DAY_MS));

  const [
    cachedUpdate,
    postCounts,
    galleryCounts,
    mediaCounts,
    momentCounts,
    commentCounts,
    friendLinkCounts,
    latestDraft,
    recentEdits,
    pendingItems,
    unrepliedItems,
    unrepliedTotal,
    storedConfig,
    writingActivity,
    visitorRows,
  ] = await Promise.all([
    versionChecker.cached(context),
    PostRepo.getAdminPostStatusCounts(db),
    DashboardRepo.countGalleryAssets(db),
    DashboardRepo.countMediaAssets(db, recentSince),
    DashboardRepo.countMoments(db),
    DashboardRepo.countPublicComments(db, recentSince),
    FriendLinkRepo.getFriendLinkStatusCounts(db),
    DashboardRepo.findLatestDraft(db),
    // One extra so the list stays full after leaving out the latest draft.
    DashboardRepo.listRecentEdits(db, DASHBOARD_RECENT_EDITS_LIMIT + 1),
    FriendLinkRepo.getAllFriendLinks(db, {
      status: "pending",
      limit: DASHBOARD_PENDING_FRIEND_LINKS_LIMIT,
    }),
    DashboardRepo.listUnrepliedComments(db, {
      limit: DASHBOARD_UNREPLIED_COMMENTS_LIMIT,
    }),
    DashboardRepo.countUnrepliedComments(db),
    ConfigRepo.getSystemConfig(db),
    DashboardRepo.countWritingEventsByHour(db, writingSince),
    VisitRepo.listVisitsSince(db, visitorsSince),
  ]);
  const config = resolveSystemConfig(storedConfig);

  return {
    adminEmailNeedsSetup: adminEmailNeedsSetup(config),
    defaultSiteIdentity: siteIdentityIsDefault(config.site),
    update: cachedUpdate?.hasUpdate
      ? {
          latestVersion: cachedUpdate.latestVersion,
          releaseUrl: cachedUpdate.releaseUrl,
        }
      : null,
    stats: {
      publishedPosts: postCounts.published,
      draftPosts: postCounts.draft,
      comments: commentCounts.total,
      recentComments: commentCounts.recent,
      moments: momentCounts.published,
      draftMoments: momentCounts.draft,
      approvedFriendLinks: friendLinkCounts.approved,
      pendingFriendLinks: friendLinkCounts.pending,
      ...galleryCounts,
      ...mediaCounts,
    },
    writingActivity,
    visitors: buildVisitorStats(visitorRows, new Date(now)),
    latestDraft,
    recentEdits: recentEdits
      // 最新那篇草稿已经在顶部露出，这里不再重复。
      .filter((edit) => !(edit.kind === "post" && edit.id === latestDraft?.id))
      .slice(0, DASHBOARD_RECENT_EDITS_LIMIT)
      .map((edit) => ({
        ...edit,
        title: edit.kind === "moment" ? momentTitle(edit.title) : edit.title,
      })),
    pendingFriendLinks: {
      items: pendingItems.map((item) => ({
        id: item.id,
        siteName: item.siteName,
        siteUrl: item.siteUrl,
        logoUrl: item.logoUrl,
        createdAt: item.createdAt,
      })),
      remainingCount: Math.max(
        0,
        friendLinkCounts.pending - pendingItems.length,
      ),
    },
    unrepliedComments: {
      total: unrepliedTotal,
      items: toDashboardComments(unrepliedItems),
    },
  };
}

/**
 * Where the moderation list sends an Admin. Same rule as the links in comment
 * notifications, so a Comment opens at the same place from either entry.
 */
function commentTargetPath(row: {
  id: number;
  targetType: "post" | "moment" | "gallery";
  targetId: number;
  targetSlug: string | null;
}): string {
  if (row.targetType === "moment") {
    return publicCommentPath(
      { targetType: "moment", momentId: row.targetId },
      row.id,
    );
  }
  if (!row.targetSlug) return "/";
  if (row.targetType === "post") {
    return publicCommentPath(
      { targetType: "post", slug: row.targetSlug },
      row.id,
    );
  }
  return publicCommentPath(
    { targetType: "gallery", slug: row.targetSlug },
    row.id,
  );
}

function toDashboardComments(
  rows: Array<
    Awaited<ReturnType<typeof DashboardRepo.listUnrepliedComments>>[number]
  >,
): Array<DashboardComment> {
  return rows.map((comment) => ({
    id: comment.id,
    targetType: comment.targetType,
    targetId: comment.targetId,
    rootId: comment.rootId,
    userId: comment.userId,
    userName: comment.userName,
    userImage: comment.userImage,
    userMuted: isMuted(comment.userMutedAt),
    targetTitle: comment.targetTitle,
    targetPath: commentTargetPath(comment),
    snippet: commentSnippet(comment.content),
    createdAt: comment.createdAt,
    handledAt: comment.handledAt,
  }));
}

/** One page of every unreplied Comment, newest first, with the total. */
export async function listUnrepliedComments(
  context: DbContext,
  input: UnrepliedCommentsInput,
) {
  const [rows, total] = await Promise.all([
    DashboardRepo.listUnrepliedComments(context.db, {
      // One extra tells whether another page follows.
      limit: input.limit + 1,
      beforeId: input.beforeId,
    }),
    DashboardRepo.countUnrepliedComments(context.db),
  ]);
  const page = rows.slice(0, input.limit);
  return {
    items: toDashboardComments(page),
    total,
    nextBeforeId:
      rows.length > input.limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/** 评论管理页：一页评论，加上各口径各自的总数。 */
export async function listAdminComments(
  context: AuthContext,
  input: AdminCommentsInput,
): Promise<AdminCommentsPage> {
  const viewerId = context.session.user.id;
  const [rows, total, all, unreplied, replied, mine] = await Promise.all([
    DashboardRepo.listAdminComments(context.db, { ...input, viewerId }),
    DashboardRepo.countAdminComments(context.db, input.filter, viewerId),
    DashboardRepo.countAdminComments(context.db, "all", viewerId),
    DashboardRepo.countAdminComments(context.db, "unreplied", viewerId),
    DashboardRepo.countAdminComments(context.db, "replied", viewerId),
    DashboardRepo.countAdminComments(context.db, "mine", viewerId),
  ]);
  return {
    items: toDashboardComments(rows),
    total,
    counts: { all, unreplied, replied, mine },
  };
}
