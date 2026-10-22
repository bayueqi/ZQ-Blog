import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { IconButton } from "@/components/ui/icon-button";

interface ToolbarButtonProps extends Omit<
  ComponentPropsWithRef<"button">,
  "children" | "className" | "type"
> {
  isActive?: boolean;
  icon: LucideIcon;
  label: string;
}

/** An icon-only button in the editor toolbar. */
export function ToolbarButton({
  isActive,
  icon: Icon,
  label,
  ...props
}: ToolbarButtonProps) {
  return (
    <IconButton
      {...props}
      label={label}
      active={isActive}
      className="fuwari-toolbar-button"
    >
      <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
    </IconButton>
  );
}
