import { Link, type LinkProps } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { moveSelection } from "./roving-selection";
import "./tabs.css";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** A number shown after the label, such as how many items the tab holds. */
  count?: ReactNode;
  disabled?: boolean;
}

function TabLabel({ label, count }: { label: ReactNode; count?: ReactNode }) {
  return (
    <>
      {label}
      {count === undefined ? null : (
        <>
          {" "}
          <span className="fuwari-tab-count">{count}</span>
        </>
      )}
    </>
  );
}

/**
 * Underlined tabs that switch a panel or filter a list. Arrow keys, Home and
 * End move between them; `children` follow the tabs, such as a spinner.
 */
export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "role" | "onChange"> & {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  "aria-label": string;
}) {
  return (
    <div
      {...props}
      role="tablist"
      className={cn("fuwari-tabs", className)}
      onKeyDown={(event) => moveSelection(event, items, value, onValueChange)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-value={item.value}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className="fuwari-tab"
            onClick={() => onValueChange(item.value)}
          >
            <TabLabel label={item.label} count={item.count} />
          </button>
        );
      })}
      {children}
    </div>
  );
}

/** The same tabs as links between routes; the current one is marked as the page. */
export function TabNav<T extends string>({
  items,
  value,
  className,
  ...props
}: Omit<ComponentProps<"nav">, "children"> & {
  items: ReadonlyArray<Omit<TabItem<T>, "disabled"> & { to: LinkProps["to"] }>;
  value: T;
  "aria-label": string;
}) {
  return (
    <nav {...props} className={cn("fuwari-tabs", className)}>
      {items.map((item) => (
        <Link
          key={item.value}
          to={item.to}
          aria-current={item.value === value ? "page" : undefined}
          className="fuwari-tab"
        >
          <TabLabel label={item.label} count={item.count} />
        </Link>
      ))}
    </nav>
  );
}
