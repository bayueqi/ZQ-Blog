import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./empty-state.css";

/**
 * A centred icon, title and muted text with optional actions, for a list or
 * panel with nothing to show. `compact` fits inside a narrow column.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "regular",
  className,
  ...props
}: Omit<ComponentProps<"div">, "title" | "children"> & {
  icon?: LucideIcon;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "compact" | "regular";
}) {
  return (
    <div {...props} className={cn("fuwari-empty", className)} data-size={size}>
      {Icon ? (
        <Icon
          size={size === "compact" ? 24 : 32}
          strokeWidth={1.5}
          aria-hidden="true"
          className="fuwari-empty-icon"
        />
      ) : null}
      {title ? <h2 className="fuwari-empty-title">{title}</h2> : null}
      {description ? (
        <div className="fuwari-empty-description">{description}</div>
      ) : null}
      {action ? <div className="fuwari-empty-actions">{action}</div> : null}
    </div>
  );
}
