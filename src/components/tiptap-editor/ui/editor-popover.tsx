import { posToDOMRect } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useMemo } from "react";
import type {
  FloatingAnchor,
  FloatingPopoverProps,
} from "@/components/ui/floating-popover";
import { FloatingPopover } from "@/components/ui/floating-popover";

/**
 * Where an editor popover sits: beside a document range (an empty range is
 * the cursor), below the DOM of the node at `pos`, or beside an element in
 * the editor.
 */
export type EditorPopoverAnchor =
  | { from: number; to: number }
  | { pos: number }
  | { element: Element };

export interface EditorPopoverProps extends Omit<
  FloatingPopoverProps,
  "anchor" | "onDismiss"
> {
  editor: Editor | null;
  anchor: EditorPopoverAnchor | null;
  /**
   * Escape or a click outside. Escape also returns focus to the editor; a
   * click outside leaves focus where it lands.
   */
  onClose: () => void;
}

/**
 * A Fuwari popover anchored to a place in the editor. It renders nothing in a
 * read-only editor.
 */
export function EditorPopover({
  editor,
  anchor,
  onClose,
  ...props
}: EditorPopoverProps) {
  const from = anchor && "from" in anchor ? anchor.from : null;
  const to = anchor && "to" in anchor ? anchor.to : null;
  const pos = anchor && "pos" in anchor ? anchor.pos : null;
  const element = anchor && "element" in anchor ? anchor.element : null;

  const reference = useMemo((): FloatingAnchor | null => {
    if (!editor || editor.isDestroyed) return null;
    if (element) return element;
    if (pos !== null) {
      const dom = editor.view.nodeDOM(pos);
      return dom instanceof Element ? dom : null;
    }
    if (from === null || to === null) return null;
    return {
      contextElement: editor.view.dom,
      getBoundingClientRect: () => {
        // The document may have shrunk while the popover animates out.
        const size = editor.state.doc.content.size;
        return posToDOMRect(
          editor.view,
          Math.min(from, size),
          Math.min(to, size),
        );
      },
    };
  }, [editor, from, to, pos, element]);

  // Read at render: a popover renders again whenever it opens.
  if (!editor || editor.isDestroyed || !editor.isEditable) return null;

  return (
    <FloatingPopover
      {...props}
      anchor={reference}
      onDismiss={(reason) => {
        onClose();
        if (reason === "escape") editor.commands.focus();
      }}
    />
  );
}
