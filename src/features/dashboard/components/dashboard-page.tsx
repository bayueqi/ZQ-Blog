import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { dashboardOverviewQuery } from "@/features/dashboard/queries";
import { orpc, orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";
import "@/components/ui/page-heading.css";
import "./dashboard.css";
import { DashboardFriendLinks } from "./dashboard-friend-links";
import { DashboardHero } from "./dashboard-hero";
import { DashboardNotices } from "./dashboard-notices";
import { DashboardRecentEdits } from "./dashboard-recent-edits";
import { DashboardStats } from "./dashboard-stats";
import { DashboardVisitors } from "./dashboard-visitors";
import { DashboardWritingActivity } from "./dashboard-writing-activity";

export function DashboardPage() {
  const { data } = useSuspenseQuery({
    ...dashboardOverviewQuery,
    // 刚看过就在阈值内直接复用，省掉一次二十多条查询的往返。
    staleTime: 15 * 1000,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => orpcClient.posts.admin.create(),
    onSuccess: (createdPost) => {
      void queryClient.invalidateQueries({
        queryKey: orpc.posts.admin.list.key(),
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.dashboard.overview.key(),
      });
      void navigate({
        to: "/admin/posts/edit/$id",
        params: { id: String(createdPost.id) },
      });
    },
  });
  const createPost = createMutation.mutate;
  const isCreating = createMutation.isPending;
  const createLabel = isCreating
    ? m.admin_posts_creating()
    : m.admin_posts_create();

  return (
    <div className="dashboard-workspace admin-workspace fuwari-card-base">
      <DashboardHero
        unrepliedTotal={data.unrepliedComments.total}
        pendingFriendLinks={data.stats.pendingFriendLinks}
        latestDraft={data.latestDraft}
        onCreate={() => createPost()}
        isCreating={isCreating}
        createLabel={createLabel}
      />
      <DashboardNotices
        update={data.update}
        adminEmailNeedsSetup={data.adminEmailNeedsSetup}
        defaultSiteIdentity={data.defaultSiteIdentity}
      />
      <DashboardStats stats={data.stats} />
      <div className="dashboard-grid">
        <div className="dashboard-column dashboard-column-main">
          <DashboardVisitors
            className="dashboard-slot-visitors"
            visitors={data.visitors}
          />
          <DashboardWritingActivity
            className="dashboard-slot-activity"
            activity={data.writingActivity}
          />
        </div>
        <div className="dashboard-column dashboard-column-side">
          <DashboardRecentEdits
            className="dashboard-slot-recent"
            recentEdits={data.recentEdits}
            hasDraft={data.latestDraft !== null}
            onCreate={() => createPost()}
            isCreating={isCreating}
            createLabel={createLabel}
          />
          <DashboardFriendLinks
            className="dashboard-slot-links"
            pendingFriendLinks={data.pendingFriendLinks}
          />
        </div>
      </div>
    </div>
  );
}
