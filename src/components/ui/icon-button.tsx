import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./button.css";

export interface IconButtonStyle {
  /** sm 32px, md 36px, lg 44px (the public toolbar). */
  size?: "sm" | "md" | "lg";
  /** Turns red on hover, for destructive actions. */
  tone?: "danger";
  /** Shows the on state, for links; buttons get it from `aria-pressed`. */
  active?: boolean;
  className?: string;
}

/** The look of a square icon button, for links that look like one. */
export function iconButtonClass({
  size = "sm",
  tone,
  active = false,
  className,
}: IconButtonStyle = {}) {
  return cn(
    "fuwari-icon-button",
    `fuwari-icon-button-${size}`,
    tone === "danger" && "fuwari-button-tone-danger",
    active && "fuwari-icon-button-active",
    className,
  );
}

interface IconButtonProps
  extends
    Omit<ComponentProps<"button">, "aria-label" | "title">,
    Omit<IconButtonStyle, "active"> {
  /** Names the button for screen readers and as its tooltip. */
  label: string;
  /** Set for toggles: whether it is on. Leave unset for actions. */
  active?: boolean;
  /** The icon. */
  children: ReactNode;
}

/** A square button showing only an icon, named by `label`. */
export function IconButton({
  label,
  active,
  size,
  tone,
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      {...props}
      aria-label={label}
      title={label}
      className={iconButtonClass({ size, tone, active, className })}
    >
      {children}
    </button>
  );
}
