import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

/** 每进一个公开页面打一个点；失败就算了，不打扰访客。 */
export function PageViewBeacon() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    void fetch("/api/visit", { method: "POST", keepalive: true }).catch(
      () => undefined,
    );
  }, [pathname]);

  return null;
}
