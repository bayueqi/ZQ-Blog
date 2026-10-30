import {
  Link,
  useLocation,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Home, LayoutDashboard, RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import { StatusPage } from "@/components/common/status-page";
import { Button, buttonClass } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

export function ErrorPage({ reset }: Partial<ErrorComponentProps>) {
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const admin = /^\/admin(?:\/|$)/.test(pathname);
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const retry = async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    setRetryFailed(false);
    try {
      // Clear failed loader matches before resetting a React render boundary.
      await router.invalidate({ sync: true });
      reset?.();
      if (router.state.matches.some((match) => match.status === "error"))
        setRetryFailed(true);
    } catch {
      setRetryFailed(true);
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  };
  return (
    <StatusPage
      code="500"
      title={m.error_title()}
      description={admin ? m.admin_error_desc() : m.error_desc()}
      action={
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={retry}
            loading={retrying}
            icon={<RotateCw size={18} aria-hidden="true" />}
          >
            {retrying ? m.error_retrying() : m.error_retry()}
          </Button>
          <Link
            to={admin ? "/admin" : "/"}
            className={buttonClass({ size: "lg" })}
          >
            {admin ? (
              <LayoutDashboard size={18} aria-hidden="true" />
            ) : (
              <Home size={18} aria-hidden="true" />
            )}
            {admin ? m.error_back_dashboard() : m.not_found_return()}
          </Link>
          {retryFailed && (
            <p className="site-status-feedback" role="status">
              {m.error_retry_failed()}
            </p>
          )}
        </>
      }
    />
  );
}
