import { useEffect, useRef, type RefObject } from "react";

/**
 * Runs `onDismiss` on a mousedown outside `ref`'s element while `enabled`.
 * It receives the event, for a caller that counts more as inside.
 */
export function useDismissOnOutside(
  ref: RefObject<Element | null>,
  onDismiss: (event: MouseEvent) => void,
  enabled = true,
) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!enabled) return;
    const onMouseDown = (event: MouseEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      dismiss.current(event);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [enabled, ref]);
}
