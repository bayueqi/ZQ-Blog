import { createContext, useContext, useRef, type ReactNode } from "react";
import { DisclosurePanel } from "@/components/ui/disclosure";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";

export const CommentEditorActive = createContext(true);
/** Retain exiting content for its collapse, but never keep an inactive challenge live. */
export function CommentReveal({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const parentActive = useContext(CommentEditorActive);
  const present = useMotionPresence(open, MOTION.panel);
  const retained = useRef(children);
  if (open) retained.current = children;
  return (
    <CommentEditorActive.Provider value={open && parentActive}>
      <DisclosurePanel
        open={open}
        inert={!open || !parentActive}
        className={className}
      >
        {present ? retained.current : null}
      </DisclosurePanel>
    </CommentEditorActive.Provider>
  );
}
