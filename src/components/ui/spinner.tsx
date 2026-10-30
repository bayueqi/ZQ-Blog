import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** A spinning loading indicator, hidden from screen readers. */
export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Loader2
      size={size}
      aria-hidden="true"
      className={cn("animate-spin", className)}
    />
  );
}
