import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { moveSelection } from "./roving-selection";
import "./segmented-control.css";

export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * A row of pills where exactly one is chosen, on a grey track or without one.
 * As a `radiogroup` it picks a value; as a `tablist` it switches panels whose
 * ids are `${idBase}-${value}-panel`.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onValueChange,
  role = "radiogroup",
  idBase,
  track = true,
  size = "md",
  stretch = false,
  className,
  ...props
}: Omit<ComponentProps<"div">, "role" | "onChange" | "children"> & {
  items: ReadonlyArray<SegmentItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  role?: "radiogroup" | "tablist";
  /** Needed for a `tablist`: the prefix of each tab's and panel's id. */
  idBase?: string;
  track?: boolean;
  size?: "sm" | "md";
  /** Share the width equally between the pills. */
  stretch?: boolean;
}) {
  const tabs = role === "tablist";
  return (
    <div
      {...props}
      role={role}
      data-track={track || undefined}
      data-size={size}
      data-stretch={stretch || undefined}
      className={cn("fuwari-segmented", className)}
      onKeyDown={(event) => moveSelection(event, items, value, onValueChange)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role={tabs ? "tab" : "radio"}
            data-value={item.value}
            aria-checked={tabs ? undefined : selected}
            aria-selected={tabs ? selected : undefined}
            id={tabs ? `${idBase}-${item.value}-tab` : undefined}
            aria-controls={tabs ? `${idBase}-${item.value}-panel` : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className="fuwari-segment"
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
