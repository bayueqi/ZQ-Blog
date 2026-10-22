import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  Mail,
  PenLine,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardOverview } from "@/features/dashboard/dashboard.schema";
import { m } from "@/paraglide/messages";
import "@/components/ui/callout.css";

/** The callout's inside: icon, a title and one line of what to do. */
function NoticeBody({
  icon: Icon,
  title,
  description,
  external = false,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description: ReactNode;
  external?: boolean;
}) {
  const Arrow = external ? ArrowUpRight : ArrowRight;
  return (
    <>
      <Icon size={18} aria-hidden="true" className="fuwari-callout-icon" />
      <span className="fuwari-callout-body dashboard-notice-body">
        <strong className="dashboard-notice-title">{title}</strong>
        <span className="dashboard-notice-description">{description}</span>
      </span>
      <Arrow size={16} aria-hidden="true" className="dashboard-notice-arrow" />
    </>
  );
}

/** Things to fix or know about, each a link to where it is handled. */
export function DashboardNotices({
  update,
  adminEmailNeedsSetup,
  defaultSiteIdentity,
}: Pick<
  DashboardOverview,
  "update" | "adminEmailNeedsSetup" | "defaultSiteIdentity"
>) {
  const notices: Array<{ key: string; node: ReactNode }> = [];
  const callout = (key: string, node: ReactNode) => notices.push({ key, node });

  if (adminEmailNeedsSetup)
    callout(
      "email",
      <Link
        from="/"
        to="/admin/settings/notifications"
        className="fuwari-callout"
        data-tone="warning"
      >
        <NoticeBody
          icon={Mail}
          title={m.admin_overview_email_needs_setup()}
          description={m.admin_overview_email_needs_setup_desc()}
        />
      </Link>,
    );
  if (defaultSiteIdentity)
    callout(
      "identity",
      <Link
        from="/"
        to="/admin/settings/site"
        className="fuwari-callout"
        data-tone="info"
      >
        <NoticeBody
          icon={PenLine}
          title={m.admin_overview_default_site_identity()}
          description={m.admin_overview_default_site_identity_desc()}
        />
      </Link>,
    );
  if (update)
    callout(
      "update",
      <a
        href={update.releaseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fuwari-callout"
        data-tone="success"
      >
        <NoticeBody
          icon={Sparkles}
          external
          title={m.admin_overview_update_available({
            version: update.latestVersion,
          })}
          description={m.admin_overview_update_available_desc({
            current: __APP_VERSION__,
          })}
        />
      </a>,
    );

  if (notices.length === 0) return null;
  return (
    <ul className="dashboard-notices" data-count={notices.length}>
      {notices.map((notice) => (
        <li key={notice.key}>{notice.node}</li>
      ))}
    </ul>
  );
}
