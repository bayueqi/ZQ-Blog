import type { Editor } from "@tiptap/react";
import { ExternalLink, Pencil, Unlink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton, iconButtonClass } from "@/components/ui/icon-button";
import { useLinkEditor } from "@/features/posts/editor/extensions/link-editing";
import { m } from "@/paraglide/messages";
import { EditorPopover } from "./editor-popover";

const OPEN_DELAY = 300;
const CLOSE_DELAY = 200;

/**
 * The card that hovering a link in the editor shows: the link's address and
 * buttons to open it in a new tab, edit it in place or remove it.
 */
export function LinkHoverCard({ editor }: { editor: Editor | null }) {
  const [link, setLink] = useState<HTMLAnchorElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const editingLink = useLinkEditor(editor) !== null;

  const cancel = useCallback(() => window.clearTimeout(timer.current), []);
  const schedule = useCallback(
    (next: HTMLAnchorElement | null, delay: number) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLink(next), delay);
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    // Listen on the document: the editor's view mounts after this effect.
    const linkIn = (target: EventTarget | null) => {
      const found =
        target instanceof Element ? target.closest("a[href]") : null;
      return found instanceof HTMLAnchorElement &&
        !editor.isDestroyed &&
        editor.view.dom.contains(found)
        ? found
        : null;
    };
    const onOver = (event: MouseEvent) => {
      const hovered = linkIn(event.target);
      if (hovered && editor.isEditable) schedule(hovered, OPEN_DELAY);
    };
    const onOut = (event: MouseEvent) => {
      const left = linkIn(event.target);
      if (!left || left.contains(event.relatedTarget as Node | null)) return;
      schedule(null, CLOSE_DELAY);
    };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      cancel();
    };
  }, [editor, schedule, cancel]);

  const close = () => {
    cancel();
    setLink(null);
  };

  /** A position inside the hovered link, if it is still in the document. */
  const linkPos = () => {
    if (!editor || !link?.isConnected) return null;
    return editor.view.posAtDOM(link, 0);
  };

  const href = link?.getAttribute("href") ?? "";

  return (
    <EditorPopover
      editor={editor}
      open={link !== null && !editingLink}
      anchor={link ? { element: link } : null}
      onClose={close}
      role="group"
      aria-label={m.editor_link_card()}
      onMouseEnter={cancel}
      onMouseLeave={() => schedule(null, CLOSE_DELAY)}
      className="flex max-w-[min(24rem,calc(100vw-1rem))] items-center gap-1 p-1"
    >
      <span
        title={href}
        className="min-w-0 flex-1 truncate px-2 font-mono text-xs fuwari-text-75"
      >
        {href}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={m.editor_link_open()}
        title={m.editor_link_open()}
        onClick={close}
        className={iconButtonClass()}
      >
        <ExternalLink size={14} />
      </a>
      <IconButton
        label={m.editor_link_edit()}
        onClick={() => {
          const pos = linkPos();
          close();
          // The input takes focus itself; focusing the editor would steal it.
          if (pos !== null) {
            editor?.chain().setTextSelection(pos).openLinkEditor().run();
          }
        }}
      >
        <Pencil size={14} />
      </IconButton>
      <IconButton
        label={m.editor_link_remove()}
        onClick={() => {
          const pos = linkPos();
          close();
          if (pos !== null) {
            editor?.chain().focus().setTextSelection(pos).unsetLink().run();
          }
        }}
      >
        <Unlink size={14} />
      </IconButton>
    </EditorPopover>
  );
}
