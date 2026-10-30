import { ClientOnly, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/page-heading";
import type { DashboardOverview } from "@/features/dashboard/dashboard.schema";
import { cn, formatTimeAgo } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { DashboardIdentity } from "./dashboard-identity";
import { formatCount } from "./format";

function siteHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Friend link requests waiting for review; shown only when there are any. */
export function DashboardFriendLinks({
  pendingFriendLinks: { items, remainingCount },
  className,
}: Pick<DashboardOverview, "pendingFriendLinks"> & { className?: string }) {
  if (items.length === 0) return null;
  const total = items.length + remainingCount;

  return (
    <section className={cn("dashboard-section dashboard-links", className)}>
      <SectionHeading
        size="md"
        title={
          <span className="dashboard-heading-count">
            {m.dashboard_pending_links_title()}
            <Badge tone="primary">{formatCount(total)}</Badge>
          </span>
        }
        actions={
          <Link
            to="/admin/friend-links"
            search={{ status: "pending", page: 1 }}
            className={buttonClass({ variant: "text", size: "sm" })}
          >
            {m.admin_overview_review_friend_links()}
            <ArrowRight size={16} />
          </Link>
        }
      />
      <ul className="dashboard-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to="/admin/friend-links"
              search={{ status: "pending", page: 1, search: item.siteUrl }}
              className="dashboard-link-row"
            >
              <DashboardIdentity
                kind="site"
                image={item.logoUrl}
                siteUrl={item.siteUrl}
              />
              <span className="dashboard-row-copy">
                <strong>{item.siteName}</strong>
                <span>{siteHost(item.siteUrl)}</span>
              </span>
              <time className="dashboard-time">
                <ClientOnly fallback="—">
                  {formatTimeAgo(item.createdAt)}
                </ClientOnly>
              </time>
            </Link>
          </li>
        ))}
      </ul>
      {remainingCount > 0 ? (
        <p className="dashboard-footnote">
          {m.dashboard_pending_links_more({ count: remainingCount })}
        </p>
      ) : null}
    </section>
  );
}
