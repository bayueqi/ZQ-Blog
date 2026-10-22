import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import "./field.css";

/**
 * An on/off switch. With `label` the whole row is the switch; without it,
 * pass `aria-label` or `aria-labelledby`.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  loading = false,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onChange" | "role" | "children"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  /** Shows a spinner in the thumb while the change is saved. */
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      role="switch"
      aria-checked={checked}
      aria-busy={loading || undefined}
      data-label={label ? true : undefined}
      className={cn("fuwari-switch", className)}
      onClick={() => onCheckedChange(!checked)}
    >
      {label ? <span>{label}</span> : null}
      <span className="fuwari-switch-track" aria-hidden="true">
        <span className="fuwari-switch-thumb">
          {loading ? <Spinner size={12} /> : null}
        </span>
      </span>
    </button>
  );
}
