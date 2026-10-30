import { useEffect, useId, useState, type ReactNode } from "react";
import { DisclosureChevron, DisclosurePanel } from "@/components/ui/disclosure";

export function SettingsDisclosure({
  title,
  children,
  className,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  return (
    <div className={`settings-disclosure ${className ?? ""}`}>
      <button
        type="button"
        className="settings-disclosure-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <DisclosureChevron />
      </button>
      <DisclosurePanel id={id} open={open}>
        {children}
      </DisclosurePanel>
    </div>
  );
}
