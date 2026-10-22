import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { PublicLayout as SitePublicLayout } from "@/components/layout/public-layout";
import { Toaster } from "@/components/layout/toaster";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { PageViewBeacon } from "@/features/visits/components/page-view-beacon";
import { authClient } from "@/lib/auth/auth-client";
import { CACHE_CONTROL } from "@/lib/constants";
import { isExternalNavHref } from "@/features/config/utils/nav-links";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
  headers: () => {
    return CACHE_CONTROL.public;
  },
});

function PublicLayout() {
  const navigate = useNavigate();
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const { logout } = useLogout();

  const navOptions = [
    { id: "home", label: m.nav_home(), href: "/", external: false },
    { id: "posts", label: m.nav_posts(), href: "/posts", external: false },
    {
      id: "gallery",
      label: m.nav_gallery(),
      href: "/gallery",
      external: false,
    },
    {
      id: "friend-links",
      label: m.nav_friend_links(),
      href: "/friend-links",
      external: false,
    },
    ...siteConfig.navLinks.map((link, index) => ({
      id: `custom-${index}`,
      label: link.label,
      href: link.href,
      external: isExternalNavHref(link.href),
    })),
  ];

  // Global shortcut: Cmd/Ctrl + K to navigate to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isToggle) {
        e.preventDefault();
        void navigate({ to: "/search" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <>
      <SitePublicLayout
        navOptions={navOptions}
        user={session?.user}
        isSessionLoading={isSessionPending}
        logout={logout}
      >
        <PageViewBeacon />
        <Outlet />
      </SitePublicLayout>
      <Toaster />
    </>
  );
}
