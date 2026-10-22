import { z } from "zod";

const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

const DashboardRecentPostSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  status: z.enum(["draft", "published"]),
  pinnedAt: coercedDate.nullable(),
  updatedAt: coercedDate,
});

const DashboardPendingFriendLinkSchema = z.object({
  id: z.number().int().positive(),
  siteName: z.string(),
  siteUrl: z.string(),
  logoUrl: z.string().nullable(),
  createdAt: coercedDate,
});

const DashboardCommentSchema = z.object({
  id: z.number().int().positive(),
  postId: z.number().int().positive(),
  rootId: z.number().int().positive().nullable(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  userImage: z.string().nullable(),
  userMuted: z.boolean(),
  postTitle: z.string(),
  postSlug: z.string(),
  snippet: z.string(),
  createdAt: coercedDate,
});

const count = z.number().int().nonnegative();

const DashboardStatsSchema = z.object({
  publishedPosts: count,
  draftPosts: count,
  /** Published Comments on public Posts. */
  comments: count,
  /** Of those, created in the last DASHBOARD_RECENT_COMMENT_DAYS days. */
  recentComments: count,
  approvedFriendLinks: count,
  pendingFriendLinks: count,
  /** Gallery categories. */
  galleries: count,
  /** Photos inside them. */
  galleryPhotos: count,
});

const DashboardWritingHourSchema = z.object({
  /** Hours since the Unix epoch, in UTC. */
  hour: count,
  /** Revisions saved and Posts created in that hour. */
  count: z.number().int().positive(),
});

const DashboardUpdateSchema = z.object({
  latestVersion: z.string(),
  releaseUrl: z.url(),
});

const VisitorItemSchema = z.object({
  /** 浏览器和系统给名字，设备给 desktop 这类键，国家给代码。 */
  label: z.string(),
  views: count,
  /** 与 visitors.days 一一对应。 */
  daily: z.array(count),
});

const VisitorDimensionSchema = z.object({
  key: z.enum(["browser", "device", "os", "country"]),
  /** 访问最多的几项，其余没列出来但算在 total 里。 */
  items: z.array(VisitorItemSchema),
});

const DashboardVisitorsSchema = z.object({
  /** 最近七个 UTC 日，旧的在前。 */
  days: z.array(z.string()),
  total: count,
  dimensions: z.array(VisitorDimensionSchema),
});

export const DashboardOverviewSchema = z.object({
  adminEmailNeedsSetup: z.boolean(),
  defaultSiteIdentity: z.boolean(),
  /** A newer stable release, known only from the version check's cache. */
  update: DashboardUpdateSchema.nullable(),
  stats: DashboardStatsSchema,
  /** 自建的访客统计，按浏览器、设备、系统、地区分组。 */
  visitors: DashboardVisitorsSchema,
  /**
   * Writing events of the last DASHBOARD_WRITING_LOOKBACK_DAYS days per UTC
   * hour, oldest first; the page groups them into local days.
   */
  writingActivity: z.array(DashboardWritingHourSchema),
  latestDraft: DashboardRecentPostSchema.nullable(),
  /** Most recently edited Posts, without `latestDraft`. */
  recentPosts: z.array(DashboardRecentPostSchema),
  pendingFriendLinks: z.object({
    items: z.array(DashboardPendingFriendLinkSchema),
    remainingCount: count,
  }),
  /** Visitor Comments no Admin has replied to, newest first. */
  unrepliedComments: z.object({
    items: z.array(DashboardCommentSchema),
    total: count,
  }),
});

export const UnrepliedCommentsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  /** Continue after this Comment: the previous page's `nextBeforeId`. */
  beforeId: z.number().int().positive().optional(),
});

export const UnrepliedCommentsPageSchema = z.object({
  items: z.array(DashboardCommentSchema),
  /** Every unreplied Comment, not only this page's. */
  total: count,
  /** Pass as `beforeId` for the next page; null on the last page. */
  nextBeforeId: z.number().int().positive().nullable(),
});

export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;
export type DashboardComment = z.infer<typeof DashboardCommentSchema>;
export type UnrepliedCommentsPage = z.infer<typeof UnrepliedCommentsPageSchema>;
export type UnrepliedCommentsInput = z.infer<
  typeof UnrepliedCommentsInputSchema
>;
