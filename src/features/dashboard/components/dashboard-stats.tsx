import { createLink } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import type { DashboardOverview } from "@/features/dashboard/dashboard.schema";
import { m } from "@/paraglide/messages";
import { formatCount } from "./format";

/** A figure in the strip: a small label, the number and one muted line. */
function StatFigureAnchor({
  label,
  value,
  detail,
  dot,
  ...props
}: Omit<ComponentProps<"a">, "children" | "className"> & {
  label: ReactNode;
  /** Already formatted, e.g. with thousands separators. */
  value: ReactNode;
  detail: ReactNode;
  /** `warning` for state that needs fixing, `primary` for something to act on. */
  dot?: "warning" | "primary";
}) {
  return (
    <a {...props} className="dashboard-stat">
      <span className="dashboard-stat-label">{label}</span>
      <span className="dashboard-stat-value">{value}</span>
      <span className="dashboard-stat-detail" data-dot={dot}>
        {detail}
      </span>
    </a>
  );
}

const StatFigure = createLink(StatFigureAnchor);

/** Six headline figures in one ruled line, each a link to its page. */
export function DashboardStats({ stats }: Pick<DashboardOverview, "stats">) {
  return (
    <ul className="dashboard-stats" aria-label={m.dashboard_stats_label()}>
      <li>
        <StatFigure
          to="/admin/posts"
          label={m.dashboard_stat_posts()}
          value={formatCount(stats.publishedPosts)}
          detail={
            stats.draftPosts > 0
              ? m.dashboard_stat_drafts({ count: stats.draftPosts })
              : m.dashboard_stat_no_drafts()
          }
        />
      </li>
      <li>
        <StatFigure
          to="/admin/moments"
          label={m.dashboard_stat_moments()}
          value={formatCount(stats.moments)}
          detail={
            stats.draftMoments > 0
              ? m.dashboard_stat_moments_drafts({ count: stats.draftMoments })
              : m.dashboard_stat_moments_all_published()
          }
        />
      </li>
      <li>
        <StatFigure
          to="/admin/gallery"
          label={m.dashboard_stat_gallery()}
          value={formatCount(stats.galleries)}
          detail={
            stats.galleryPhotos > 0
              ? m.gallery_photo_count({ count: stats.galleryPhotos })
              : m.dashboard_stat_gallery_no_photos()
          }
        />
      </li>
      <li>
        <StatFigure
          to="/admin/friend-links"
          search={{
            status: stats.pendingFriendLinks > 0 ? "pending" : "approved",
            page: 1,
          }}
          label={m.dashboard_stat_friend_links()}
          value={formatCount(stats.approvedFriendLinks)}
          detail={
            stats.pendingFriendLinks > 0
              ? m.dashboard_stat_friend_links_pending({
                  count: stats.pendingFriendLinks,
                })
              : m.dashboard_stat_friend_links_none_pending()
          }
          dot={stats.pendingFriendLinks > 0 ? "primary" : undefined}
        />
      </li>
      <li>
        <StatFigure
          to="/admin/comments"
          label={m.dashboard_stat_comments()}
          value={formatCount(stats.comments)}
          detail={
            stats.recentComments > 0
              ? m.dashboard_stat_comments_recent({
                  count: stats.recentComments,
                })
              : m.dashboard_stat_comments_none_recent()
          }
        />
      </li>
      <li>
        <StatFigure
          to="/admin/media"
          label={m.dashboard_stat_media()}
          value={formatCount(stats.mediaAssets)}
          detail={
            stats.recentMediaAssets > 0
              ? m.dashboard_stat_media_recent({
                  count: stats.recentMediaAssets,
                })
              : m.dashboard_stat_media_none_recent()
          }
        />
      </li>
    </ul>
  );
}
