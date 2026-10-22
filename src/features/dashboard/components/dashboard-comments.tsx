import { ClientOnly } from "@tanstack/react-router";
import { MessageCircleHeart } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/page-heading";
import type { DashboardComment } from "@/features/dashboard/dashboard.schema";
import { useHandledComments } from "@/features/dashboard/hooks/use-handled-comments";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { formatCount } from "./format";
import { UnrepliedCommentList } from "./unreplied-comment-list";
import { UnrepliedCommentsSheet } from "./unreplied-comments-sheet";

/**
 * Visitor Comments still waiting for an Admin, with reply, mark handled,
 * delete and mute at hand; the rest open in a sheet. A Comment leaves the
 * list once an Admin replies to it or marks it handled.
 */
export function DashboardComments({
  comments,
  total,
  className,
}: {
  comments: Array<DashboardComment>;
  total: number;
  className?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { markHandled, markAllHandled, isMarkingAll } = useHandledComments();

  return (
    <section
      id="dashboard-unreplied"
      className={cn("dashboard-section dashboard-comments", className)}
    >
      <SectionHeading
        size="md"
        title={
          <span className="dashboard-heading-count">
            {m.dashboard_unreplied_title()}
            {total > 0 ? (
              <Badge tone="primary">{formatCount(total)}</Badge>
            ) : null}
          </span>
        }
        titleProps={{ ref: headingRef, tabIndex: -1 }}
      />
      {comments.length === 0 ? (
        <EmptyState
          size="compact"
          icon={MessageCircleHeart}
          title={m.dashboard_unreplied_empty_title()}
          description={m.dashboard_unreplied_empty_desc()}
        />
      ) : (
        <UnrepliedCommentList
          comments={comments}
          onMarkHandled={markHandled}
          fallbackFocus={() => headingRef.current}
        />
      )}
      {total > comments.length ? (
        <div className="dashboard-footnote">
          <Button
            variant="text"
            size="sm"
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
          >
            {m.dashboard_unreplied_more({ count: total - comments.length })}
          </Button>
        </div>
      ) : null}
      <ClientOnly>
        <UnrepliedCommentsSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          total={total}
          onMarkHandled={markHandled}
          onMarkAllHandled={markAllHandled}
          isMarkingAll={isMarkingAll}
        />
      </ClientOnly>
    </section>
  );
}
