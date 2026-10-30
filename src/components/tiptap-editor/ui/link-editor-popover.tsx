import type { Editor } from "@tiptap/react";
import { CornerDownLeft } from "lucide-react";
import { useRef } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useLinkEditor } from "@/features/posts/editor/extensions/link-editing";
import { m } from "@/paraglide/messages";
import { EditorPopover } from "./editor-popover";

/**
 * The in-place link input that Mod-k and the toolbar open beside the
 * selection. Enter applies, Escape cancels, and applying an empty address
 * removes the link.
 */
export function LinkEditorPopover({ editor }: { editor: Editor | null }) {
  const target = useLinkEditor(editor);
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = () => {
    editor?.commands.applyLink(inputRef.current?.value ?? "");
  };

  return (
    <EditorPopover
      editor={editor}
      open={target !== null}
      anchor={target}
      onClose={() => editor?.commands.closeLinkEditor()}
      initialFocus={() => inputRef.current}
      role="dialog"
      aria-label={m.editor_link_edit()}
      className="flex w-80 max-w-[calc(100vw-1rem)] items-center gap-1 p-1"
    >
      <input
        // A fresh input per target starts from that link's address.
        key={target ? `${target.from}:${target.to}` : "closed"}
        ref={inputRef}
        type="text"
        inputMode="url"
        aria-label={m.editor_link_url()}
        defaultValue={target?.href ?? ""}
        placeholder="https://"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          apply();
        }}
        className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm fuwari-text-90 outline-none placeholder:fuwari-text-30"
      />
      <IconButton label={m.editor_link_apply()} onClick={apply}>
        <CornerDownLeft size={14} />
      </IconButton>
    </EditorPopover>
  );
}
