import { resolveSystemConfig } from "@/features/config/config.resolve";
import * as ConfigRepo from "@/features/config/data/config.data";
import * as DashboardRepo from "@/features/dashboard/data/dashboard.data";
import {
  adminEmailNeedsSetup,
  commentSnippet,
  DASHBOARD_PENDING_FRIEND_LINKS_LIMIT,
  DASHBOARD_RECENT_COMMENT_DAYS,
  DASHBOARD_RECENT_POSTS_LIMIT,
  DASHBOARD_UNREPLIED_COMMENTS_LIMIT,
  DASHBOARD_WRITING_LOOKBACK_DAYS,
  siteIdentityIsDefault,
} from "@/features/dashboard/dashboard";
import type {
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

export async function getDashboardOverview(
  context: DbContext,
): Promise<DashboardOverview> {
  const { db } = context;
  const now = Date.now();
  const recentCommentsSince = new Date(
    now - DASHBOARD_RECENT_COMMENT_DAYS * DAY_MS,
  );
  const writingSince = new Date(now - DASHBOARD_WRITING_LOOKBACK_DAYS * DAY_MS);
  const visitorsSince = utcDay(new Date(now - (VISIT_RANGE_DAYS - 1) * DAY_MS));

  const [
    cachedUpdate,
    postCounts,
    galleryCounts,
    commentCounts,
    friendLinkCounts,
    latestDraft,
    recentPosts,
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
    DashboardRepo.countPublicComments(db, recentCommentsSince),
    FriendLinkRepo.getFriendLinkStatusCounts(db),
    DashboardRepo.findLatestDraft(db),
    // One extra so the list stays full after leaving out the latest draft.
    DashboardRepo.listRecentPosts(db, DASHBOARD_RECENT_POSTS_LIMIT + 1),
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
      approvedFriendLinks: friendLinkCounts.approved,
      pendingFriendLinks: friendLinkCounts.pending,
      ...galleryCounts,
    },
    writingActivity,
    visitors: buildVisitorStats(visitorRows, new Date(now)),
    latestDraft,
    recentPosts: recentPosts
      .filter((post) => post.id !== latestDraft?.id)
      .slice(0, DASHBOARD_RECENT_POSTS_LIMIT),
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

function toDashboardComments(
  rows: Awaited<ReturnType<typeof DashboardRepo.listUnrepliedComments>>,
): Array<DashboardComment> {
  return rows.flatMap((comment) => {
    if (!comment.postSlug) return [];
    return [
      {
        id: comment.id,
        postId: comment.postId,
        rootId: comment.rootId,
        userId: comment.userId,
        userName: comment.userName,
        userImage: comment.userImage,
        userMuted: isMuted(comment.userMutedAt),
        postTitle: comment.postTitle,
        postSlug: comment.postSlug,
        snippet: commentSnippet(comment.content),
        createdAt: comment.createdAt,
      },
    ];
  });
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
