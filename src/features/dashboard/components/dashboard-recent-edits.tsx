import { ClientOnly, Link } from "@tanstack/react-router";
import { Pin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/page-heading";
import type { DashboardOverview } from "@/features/dashboard/dashboard.schema";
import { PostStatusBadge } from "@/features/posts/components/post-status-badge";
import { cn, formatTimeAgo } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type RecentEdit = DashboardOverview["recentEdits"][number];

const KIND_LABEL: Record<RecentEdit["kind"], () => string> = {
  post: () => m.dashboard_recent_kind_post(),
  gallery: () => m.dashboard_recent_kind_gallery(),
  moment: () => m.dashboard_recent_kind_moment(),
};

const EDIT_LINK_CLASS = "dashboard-recent-post";

/** 三种内容各自的管理页，链接形状不同，所以分开渲染。 */
function EditLink({
  edit,
  children,
}: {
  edit: RecentEdit;
  children: React.ReactNode;
}) {
  if (edit.kind === "gallery") {
    return (
      <Link
        to="/admin/gallery"
        search={{ collection: edit.id }}
        className={EDIT_LINK_CLASS}
      >
        {children}
      </Link>
    );
  }
  if (edit.kind === "moment") {
    return (
      <Link
        to="/admin/moments"
        search={{ moment: edit.id }}
        className={EDIT_LINK_CLASS}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to="/admin/posts/edit/$id"
      params={{ id: String(edit.id) }}
      className={EDIT_LINK_CLASS}
    >
      {children}
    </Link>
  );
}

/** 最近改动的文章、相册、日常，最新的一篇草稿由顶部那块单独展示。 */
export function DashboardRecentEdits({
  recentEdits,
  hasDraft,
  onCreate,
  isCreating,
  createLabel,
  className,
}: Pick<DashboardOverview, "recentEdits"> & {
  hasDraft: boolean;
  onCreate: () => void;
  isCreating: boolean;
  createLabel: string;
  className?: string;
}) {
  if (recentEdits.length === 0 && hasDraft) return null;

  return (
    <section className={cn("dashboard-section dashboard-recent", className)}>
      <SectionHeading size="md" title={m.dashboard_recent_edits()} />
      {recentEdits.length === 0 ? (
        <EmptyState
          size="compact"
          description={m.dashboard_first_post()}
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
          {recentEdits.map((edit) => (
            <li key={`${edit.kind}-${edit.id}`}>
              <EditLink edit={edit}>
                <span className="dashboard-recent-kind">
                  {KIND_LABEL[edit.kind]()}
                </span>
                <span className="dashboard-recent-title">
                  {edit.title.trim() || m.common_untitled()}
                </span>
                {edit.pinnedAt ? (
                  <Pin
                    size={13}
                    className="dashboard-pin"
                    aria-label={m.admin_posts_pinned()}
                  />
                ) : null}
                <PostStatusBadge published={edit.published} />
                <time className="dashboard-time">
                  <ClientOnly fallback="—">
                    {formatTimeAgo(edit.updatedAt)}
                  </ClientOnly>
                </time>
              </EditLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
