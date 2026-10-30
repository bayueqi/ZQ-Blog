import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Clears the sticky navbar. Post headings carry the same `scroll-margin-top`,
 * so a link that opens on a section lands where a jump does.
 */
const HEADING_SCROLL_OFFSET_PX = 80;

/**
 * Puts a heading's id in the URL without a history entry, then scrolls the
 * heading just below the navbar. `stillWanted` lets a caller drop a jump that
 * a newer one replaced while the URL was updating.
 */
export function useJumpToHeading() {
  const navigate = useNavigate();
  return useCallback(
    async (id: string, stillWanted: () => boolean = () => true) => {
      const element = document.getElementById(id);
      if (!element) return;
      await navigate({
        hash: id,
        replace: true,
        resetScroll: false,
        hashScrollIntoView: false,
        state: (previous) => previous,
      });
      if (!stillWanted() || !element.isConnected) return;
      const top =
        element.getBoundingClientRect().top +
        window.scrollY -
        HEADING_SCROLL_OFFSET_PX;
      window.scrollTo({
        top,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    },
    [navigate],
  );
}
