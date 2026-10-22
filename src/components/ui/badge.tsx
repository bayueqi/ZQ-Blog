import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import "./badge.css";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

/** A short status or tag label. */
export function Badge({
  tone = "neutral",
  size = "md",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone; size?: "sm" | "md" }) {
  return (
    <span
      {...props}
      className={cn("fuwari-badge", className)}
      data-tone={tone}
      data-size={size}
    />
  );
}
