import type { Middleware, Placement, VirtualElement } from "@floating-ui/dom";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
} from "@floating-ui/dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useDismissOnOutside } from "@/hooks/use-dismiss-on-outside";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";
import {
  POPOVER_PANEL_CLASS,
  popoverMotionOrigin,
} from "./use-anchored-popover";

/** What a floating popover sits beside: an element or a measured rectangle. */
export type FloatingAnchor = Element | VirtualElement;

export type FloatingDismissReason = "escape" | "outside" | "scroll";

/**
 * An anchor at a rectangle measured elsewhere, such as a suggestion's text or
 * a table cell. While `getRect` has nothing to measure, the popover stays at
 * the last rectangle. `contextElement` is watched for scrolling and moves.
 */
export function virtualAnchor(
  getRect: () => DOMRect | null | undefined,
  contextElement?: Element,
): VirtualElement {
  let last = new DOMRect();
  return {
    contextElement,
    getBoundingClientRect: () => (last = getRect() ?? last),
  };
}

export interface FloatingPopoverProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "style" | "children"
> {
  open: boolean;
  /** Keep it referentially stable while open: a new anchor re-measures. */
  anchor: FloatingAnchor | null;
  /**
   * Escape anywhere, a mousedown outside the popover and its anchor, or with
   * `closeOnScroll` a scroll or resize.
   */
  onDismiss?: (reason: FloatingDismissReason) => void;
  /** False for a popover only its owner closes, such as a toolbar. */
  dismissible?: boolean;
  /** Escape also focuses the anchor, when it is an element. */
  returnFocusOnEscape?: boolean;
  /** Close on a scroll outside the popover or a resize, instead of following. */
  closeOnScroll?: boolean;
  /** A mousedown where this holds does not count as outside. */
  ignoreOutside?: (target: Node) => boolean;
  /** The preferred side; it flips when there is no room. */
  placement?: Placement;
  /** As wide as the anchor. */
  matchTriggerWidth?: boolean;
  /** At most this tall, and shorter when the room beside the anchor is. */
  maxHeight?: number;
  /**
   * Focused in the same commit that positions and shows the popover, so it
   * is never visible without its focus.
   */
  initialFocus?: () => HTMLElement | null;
  children: ReactNode;
}

const GAP = 6;
const VIEWPORT_PADDING = 8;

/**
 * A card portalled to the body and positioned beside `anchor` with fixed
 * positioning. It flips and shifts to stay in the viewport, follows the
 * anchor on scroll and resize, and animates in and out with the Fuwari
 * popover motion.
 *
 * The panel stays hidden until it is first positioned. It is
 * `data-state="open"` only from then on, once it shows and holds its initial
 * focus, so the entrance motion starts when it appears; `"closing"` while it
 * animates out.
 */
export function FloatingPopover({
  open,
  anchor,
  onDismiss,
  dismissible = true,
  returnFocusOnEscape = false,
  closeOnScroll = false,
  ignoreOutside,
  placement = "bottom-start",
  matchTriggerWidth = false,
  maxHeight,
  initialFocus,
  className,
  children,
  ...rest
}: FloatingPopoverProps) {
  const present = useMotionPresence(open, MOTION.popover);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  // Stay beside the last anchor while animating out.
  const lastAnchor = useRef(anchor);
  if (anchor) lastAnchor.current = anchor;
  const reference = anchor ?? (present ? lastAnchor.current : null);

  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const isIgnored = useRef(ignoreOutside);
  isIgnored.current = ignoreOutside;
  const focusTarget = useRef(initialFocus);
  focusTarget.current = initialFocus;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!present || !reference || !panel) {
      setPosition(null);
      return;
    }
    let active = true;
    let sized: CSSProperties = {};
    const middleware: Array<Middleware> = [
      offset(GAP),
      flip({ padding: VIEWPORT_PADDING }),
      shift({ padding: VIEWPORT_PADDING }),
    ];
    if (matchTriggerWidth || maxHeight !== undefined) {
      middleware.push(
        size({
          padding: VIEWPORT_PADDING,
          apply: ({ rects, availableHeight }) => {
            sized = {
              width: matchTriggerWidth ? rects.reference.width : undefined,
              maxHeight:
                maxHeight === undefined
                  ? undefined
                  : Math.min(maxHeight, availableHeight),
            };
          },
        }),
      );
    }
    const stop = autoUpdate(reference, panel, () => {
      void computePosition(reference, panel, {
        strategy: "fixed",
        placement,
        middleware,
      }).then(({ x, y, placement: placed }) => {
        if (!active) return;
        setPosition({
          position: "fixed",
          left: x,
          top: y,
          ...sized,
          ...popoverMotionOrigin(
            placed.startsWith("top"),
            placed.endsWith("end") ? "right" : "left",
          ),
        });
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, [present, reference, placement, matchTriggerWidth, maxHeight]);

  const positioned = position !== null;
  // A layout effect, so a keystroke can never reach the page between the
  // popover appearing and its focus moving in.
  useLayoutEffect(() => {
    if (open && positioned) focusTarget.current?.()?.focus();
  }, [open, positioned]);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // A menu that handled Escape first keeps the popover open.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      dismiss.current?.("escape");
      if (returnFocusOnEscape && reference instanceof HTMLElement)
        reference.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismissible, returnFocusOnEscape, reference]);

  useDismissOnOutside(
    panelRef,
    (event) => {
      const target = event.target as Node;
      if (reference instanceof Element && reference.contains(target)) return;
      if (isIgnored.current?.(target)) return;
      dismiss.current?.("outside");
    },
    open && dismissible,
  );

  useEffect(() => {
    if (!open || !dismissible || !closeOnScroll) return;
    const close = () => dismiss.current?.("scroll");
    // Scrolling inside the popover does not move the anchor.
    const onScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("resize", close);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open, dismissible, closeOnScroll]);

  if (!present || !reference) return null;

  return createPortal(
    <div
      {...rest}
      ref={panelRef}
      data-state={open ? (positioned ? "open" : undefined) : "closing"}
      inert={!open}
      aria-hidden={!open || undefined}
      style={{
        ...(position ?? { position: "fixed", left: 0, top: 0, maxHeight }),
        visibility: positioned ? undefined : "hidden",
      }}
      className={cn(POPOVER_PANEL_CLASS, className)}
    >
      {children}
    </div>,
    document.body,
  );
}
