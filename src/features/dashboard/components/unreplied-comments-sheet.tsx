import { useInfiniteQuery } from "@tanstack/react-query";
import { CheckCheck, MessageCircleHeart, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { SectionHeading } from "@/components/ui/page-heading";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { unrepliedCommentsInfiniteQuery } from "@/features/dashboard/queries";
import { m } from "@/paraglide/messages";
import { formatCount } from "./format";
import { UnrepliedCommentList } from "./unreplied-comment-list";
import "./unreplied-comments-sheet.css";

/**
 * Every Comment awaiting a reply, beside the dashboard: the same quick
 * actions as its rows, a page at a time, and one button to mark them all
 * handled. Portalled to the body, since the dashboard's query container
 * would otherwise hold the fixed sheet; render it on the client only.
 */
export function UnrepliedCommentsSheet({
  open,
  onClose,
  total,
  onMarkHandled,
  onMarkAllHandled,
  isMarkingAll,
}: {
  open: boolean;
  onClose: () => void;
  /** The overview's count, shown until the sheet's first page arrives. */
  total: number;
  onMarkHandled: (id: number) => void;
  onMarkAllHandled: () => Promise<unknown>;
  isMarkingAll: boolean;
}) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const markAllTrigger = useRef<HTMLButtonElement>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const query = useInfiniteQuery({
    ...unrepliedCommentsInfiniteQuery,
    enabled: open,
    refetchOnMount: "always",
  });
  const comments = query.data?.pages.flatMap((page) => page.items) ?? [];
  const count = query.data?.pages.at(-1)?.total ?? total;

  return createPortal(
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      aria-labelledby={titleId}
      initialFocus={() => headingRef.current}
    >
      <div className="unreplied-sheet admin-workspace">
        <div className="unreplied-sheet-head">
          <SectionHeading
            size="sm"
            title={
              <span className="dashboard-heading-count">
                {m.dashboard_unreplied_title()}
                {count > 0 ? (
                  <Badge tone="primary">{formatCount(count)}</Badge>
                ) : null}
              </span>
            }
            titleProps={{ id: titleId, ref: headingRef, tabIndex: -1 }}
            actions={
              <IconButton size="md" label={m.common_close()} onClick={onClose}>
                <X size={18} />
              </IconButton>
            }
          />
          {count > 0 ? (
            <div className="unreplied-sheet-actions">
              <Button
                ref={markAllTrigger}
                variant="regular"
                size="sm"
                icon={<CheckCheck size={15} />}
                onClick={() => setConfirmAll(true)}
              >
                {m.dashboard_unreplied_handle_all({ count })}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="unreplied-sheet-list custom-scrollbar">
          {query.isPending ? (
            <div className="unreplied-sheet-loading" aria-busy="true">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : query.isError && comments.length === 0 ? (
            <EmptyState
              size="compact"
              role="alert"
              description={m.dashboard_unreplied_load_error()}
              action={
                <Button variant="text" onClick={() => void query.refetch()}>
                  {m.error_retry()}
                </Button>
              }
            />
          ) : comments.length === 0 ? (
            <EmptyState
              size="compact"
              icon={MessageCircleHeart}
              title={m.dashboard_unreplied_empty_title()}
              description={m.dashboard_unreplied_empty_desc()}
            />
          ) : (
            <>
              <UnrepliedCommentList
                comments={comments}
                onMarkHandled={onMarkHandled}
                fallbackFocus={() => headingRef.current}
              />
              {query.hasNextPage ? (
                <div className="unreplied-sheet-more">
                  <Button
                    variant="text"
                    size="sm"
                    loading={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                  >
                    {m.dashboard_unreplied_load_more()}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <ConfirmationModal
          isOpen={confirmAll}
          title={m.dashboard_unreplied_handle_all_title()}
          message={m.dashboard_unreplied_handle_all_desc({ count })}
          confirmLabel={m.dashboard_unreplied_handle_all_confirm()}
          isLoading={isMarkingAll}
          onClose={() => setConfirmAll(false)}
          onConfirm={async () => {
            if (isMarkingAll) return;
            try {
              await onMarkAllHandled();
            } finally {
              setConfirmAll(false);
            }
          }}
          returnFocus={() =>
            markAllTrigger.current?.isConnected
              ? markAllTrigger.current
              : headingRef.current
          }
        />
      </div>
    </Sheet>,
    document.body,
  );
}
