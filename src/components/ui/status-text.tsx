import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A one-line result under an action: announced politely when it succeeds,
 * as an alert when it fails.
 */
export function StatusText({
  error = false,
  className,
  ...props
}: ComponentProps<"p"> & { error?: boolean }) {
  return (
    <p
      role={error ? "alert" : "status"}
      {...props}
      data-tone={error ? "danger" : "success"}
      className={cn(
        "text-[13px] leading-[1.6]",
        error ? "text-(--fuwari-danger-fg)" : "text-(--fuwari-success-fg)",
        className,
      )}
    />
  );
}
