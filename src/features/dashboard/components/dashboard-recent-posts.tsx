import { ClientOnly, Link } from "@tanstack/react-router";
import { ArrowRight, FilePen, Pin, Plus } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/page-heading";
import type { DashboardOverview } from "@/features/dashboard/dashboard.schema";
import { PostStatusBadge } from "@/features/posts/components/post-status-badge";
import { cn, formatTimeAgo } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The last few Posts edited, besides the draft the hero offers. */
export function DashboardRecentPosts({
  recentPosts,
  hasDraft,
  onCreate,
  isCreating,
  createLabel,
  className,
}: Pick<DashboardOverview, "recentPosts"> & {
  hasDraft: boolean;
  onCreate: () => void;
  isCreating: boolean;
  createLabel: string;
  className?: string;
}) {
  if (recentPosts.length === 0 && hasDraft) return null;

  return (
    <section className={cn("dashboard-section dashboard-recent", className)}>
      <SectionHeading
        size="md"
        title={m.dashboard_recent_edits()}
        actions={
          recentPosts.length > 0 ? (
            <Link
              to="/admin/posts"
              className={buttonClass({ variant: "text", size: "sm" })}
            >
              {m.admin_overview_all_posts()}
              <ArrowRight size={16} />
            </Link>
          ) : undefined
        }
      />
      {recentPosts.length === 0 ? (
        <EmptyState
          size="compact"
          icon={FilePen}
          title={m.dashboard_first_post()}
          description={m.admin_posts_empty_library()}
          action={
            <Button
              variant="primary"
              onClick={onCreate}
              loading={isCreating}
              icon={<Plus size={18} />}
            >
              {createLabel}
            </Button>
          }
        />
      ) : (
        <ul className="dashboard-recent-list">
          {recentPosts.map((post) => (
            <li key={post.id}>
              <Link
                to="/admin/posts/edit/$id"
                params={{ id: String(post.id) }}
                className="dashboard-recent-post"
              >
                <span className="dashboard-recent-title">
                  {post.title.trim() || m.common_untitled()}
                </span>
                {post.pinnedAt ? (
                  <Pin
                    size={13}
                    className="dashboard-pin"
                    aria-label={m.admin_posts_pinned()}
                  />
                ) : null}
                <PostStatusBadge published={post.status === "published"} />
                <time className="dashboard-time">
                  <ClientOnly fallback="—">
                    {formatTimeAgo(post.updatedAt)}
                  </ClientOnly>
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
