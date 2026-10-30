import { Link, useLocation } from "@tanstack/react-router";
import { FileText, Home, LayoutDashboard, Search } from "lucide-react";
import { StatusPage } from "@/components/common/status-page";
import { buttonClass } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

export function NotFound() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const admin = /^\/admin(?:\/|$)/.test(pathname);
  return (
    <StatusPage
      code="404"
      title={m.not_found_title()}
      description={admin ? m.admin_not_found_desc() : m.not_found_desc()}
      action={
        <>
          <Link
            to={admin ? "/admin" : "/"}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {admin ? (
              <LayoutDashboard size={18} aria-hidden="true" />
            ) : (
              <Home size={18} aria-hidden="true" />
            )}
            {admin ? m.error_back_dashboard() : m.not_found_return()}
          </Link>
          <Link
            to={admin ? "/admin/posts" : "/search"}
            className={buttonClass({ size: "lg" })}
          >
            {admin ? (
              <FileText size={18} aria-hidden="true" />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
            {admin ? m.admin_sidebar_posts() : m.search_page_heading()}
          </Link>
        </>
      }
    />
  );
}
