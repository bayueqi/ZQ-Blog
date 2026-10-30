import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import type { ReactNode } from "react";
import { StatusIcon } from "@/components/ui/status-icon";

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="auth-heading">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}
export function AuthStatus({
  state,
  title,
  description,
  children,
}: {
  state: "email" | "success" | "error" | "loading";
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const Icon =
    state === "loading"
      ? Loader2
      : state === "email"
        ? MailCheck
        : state === "success"
          ? CheckCircle2
          : AlertCircle;
  return (
    <div className="auth-page auth-status fuwari-content-enter">
      <StatusIcon
        icon={Icon}
        tone={state === "error" ? "danger" : "primary"}
        spin={state === "loading"}
        className="mx-auto"
      />
      <div role={state === "error" ? "alert" : "status"}>
        <AuthHeading title={title} description={description} />
      </div>
      {children && <div className="auth-status-actions">{children}</div>}
    </div>
  );
}
