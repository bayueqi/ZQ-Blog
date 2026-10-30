import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-heading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MutedUsersSettingsSection } from "@/features/muted-users/components/muted-users-settings-section";
import { UnrepliedCommentList } from "@/features/dashboard/components/unreplied-comment-list";
import { useHandledComments } from "@/features/dashboard/hooks/use-handled-comments";
import { orpc } from "@/lib/orpc";
import { m } from "@/paraglide/messages";
import "@/features/dashboard/components/dashboard.css";
import { adminCommentsInfiniteQuery } from "../queries";
import "./comments-admin.css";

type CommentFilter = "all" | "unreplied" | "replied" | "mine";
type Filter = CommentFilter | "muted";

const EMPTY: Record<CommentFilter, { title: () => string }> = {
  all: {
    title: () => m.admin_comments_empty_all(),
  },
  unreplied: {
    title: () => m.admin_comments_empty_unreplied(),
  },
  replied: {
    title: () => m.admin_comments_empty_replied(),
  },
  mine: {
    title: () => m.admin_comments_empty_mine(),
  },
};

/** 评论管理：全部 / 未回复 / 已回复 / 我的评论，外加禁言名单。 */
export function AdminCommentsPage({ initialTab }: { initialTab?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialTab ?? "all");
  const queryClient = useQueryClient();
  const anchorRef = useRef<HTMLDivElement>(null);
  const { markHandled, unmarkHandled } = useHandledComments();
  const commentFilter: CommentFilter = filter === "muted" ? "all" : filter;
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    ...adminCommentsInfiniteQuery(commentFilter),
    enabled: filter !== "muted",
  });

  const comments = data?.pages.flatMap((page) => page.items) ?? [];
  const counts = data?.pages[0]?.counts;

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.comments.admin.list.key(),
    });
  };

  return (
    <div
      ref={anchorRef}
      className="dashboard-workspace admin-workspace fuwari-card-base comments-workspace"
    >
      <PageHeader
        title={m.admin_comments_title()}
        description={
          counts
            ? m.admin_comments_total({ count: counts.all + counts.mine })
            : "—"
        }
      />

      <SegmentedControl
        className="comments-admin-filters"
        size="sm"
        items={[
          {
            value: "all",
            label: `${m.admin_comments_filter_all()}${
              counts ? ` ${counts.all}` : ""
            }`,
          },
          {
            value: "unreplied",
            label: `${m.admin_comments_filter_unreplied()}${
              counts ? ` ${counts.unreplied}` : ""
            }`,
          },
          {
            value: "replied",
            label: `${m.admin_comments_filter_replied()}${
              counts ? ` ${counts.replied}` : ""
            }`,
          },
          {
            value: "mine",
            label: `${m.admin_comments_filter_mine()}${
              counts ? ` ${counts.mine}` : ""
            }`,
          },
          {
            value: "muted",
            label: m.muted_users_title(),
          },
        ]}
        value={filter}
        onValueChange={(value) => setFilter(value as Filter)}
      />

      {filter === "muted" ? (
        <MutedUsersSettingsSection />
      ) : isError ? (
        <EmptyState
          role="alert"
          description={m.error_desc()}
          action={
            <Button variant="text" onClick={() => void refetch()}>
              {m.error_retry()}
            </Button>
          }
        />
      ) : isLoading ? null : comments.length === 0 ? (
        <EmptyState description={EMPTY[filter].title()} />
      ) : (
        <UnrepliedCommentList
          comments={comments}
          onMarkHandled={markHandled}
          onUnmarkHandled={unmarkHandled}
          fallbackFocus={() => anchorRef.current}
          onChanged={refresh}
        />
      )}

      {filter !== "muted" && hasNextPage ? (
        <div className="comments-admin-more">
          <Button
            variant="text"
            size="sm"
            loading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {m.admin_comments_load_more()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
