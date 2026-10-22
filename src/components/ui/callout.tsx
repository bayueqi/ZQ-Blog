import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./callout.css";

type CalloutTone = "info" | "warning" | "danger" | "success";

/**
 * A tinted notice. A link that is itself a notice takes the
 * `fuwari-callout` class and a `data-tone` instead.
 */
export function Callout({
  tone = "info",
  icon: Icon,
  action,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  tone?: CalloutTone;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div
      {...props}
      className={cn("fuwari-callout", className)}
      data-tone={tone}
    >
      {Icon ? (
        <Icon size={18} aria-hidden="true" className="fuwari-callout-icon" />
      ) : null}
      <div className="fuwari-callout-body">
        {children}
        {action ? <div className="fuwari-callout-actions">{action}</div> : null}
      </div>
    </div>
  );
}
