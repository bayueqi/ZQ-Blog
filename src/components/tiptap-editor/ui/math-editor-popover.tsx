import type { Editor } from "@tiptap/react";
import { useRef } from "react";
import { useMathEditor } from "@/features/posts/editor/extensions/math-editing";
import { MathEditorPanel } from "@/features/posts/editor/extensions/math-editing/math-editor-panel";
import { m } from "@/paraglide/messages";
import { EditorPopover } from "./editor-popover";

/**
 * The formula editing popover below the inline formula open for editing.
 * Block formulas expand their editing in place instead.
 */
export function MathEditorPopover({ editor }: { editor: Editor | null }) {
  const open = useMathEditor(editor);
  const target = open?.type === "inline" ? open : null;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <EditorPopover
      editor={editor}
      open={target !== null}
      anchor={target && { pos: target.pos }}
      onClose={() => editor?.commands.closeMathEditor()}
      initialFocus={() => inputRef.current}
      role="dialog"
      aria-label={
        target?.inserted ? m.editor_formula_insert() : m.editor_formula_edit()
      }
      className="w-md max-w-[calc(100vw-1rem)] p-2"
    >
      {target && (
        <MathEditorPanel
          // A fresh panel per formula starts from its LaTeX.
          key={target.pos}
          latex={target.latex}
          type={target.type}
          inputRef={inputRef}
          onApply={(latex, type) => editor?.commands.applyMath(latex, type)}
          onCancel={() => {
            editor?.commands.closeMathEditor();
            editor?.commands.focus();
          }}
        />
      )}
    </EditorPopover>
  );
}
