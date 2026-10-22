import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import "./disclosure.css";

/**
 * Content that grows open from nothing. Closed, it stays mounted but inert
 * and hidden from assistive tech; `inert` also shuts an open panel whose
 * surroundings are inactive.
 */
export function DisclosurePanel({
  open,
  inert = !open,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "aria-hidden"> & { open: boolean }) {
  return (
    <div
      {...props}
      className={cn("fuwari-disclosure", className)}
      data-open={open}
      inert={inert}
      aria-hidden={inert}
    >
      <div>{children}</div>
    </div>
  );
}

/** Turns over while its parent trigger has `aria-expanded="true"`. */
export function DisclosureChevron({ size = 16 }: { size?: number }) {
  return (
    <ChevronDown
      size={size}
      aria-hidden="true"
      className="fuwari-disclosure-chevron"
    />
  );
}
