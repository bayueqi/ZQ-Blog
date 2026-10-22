import type { ReactNodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import type { KatexOptions } from "katex";
import { useEffect, useMemo, useRef } from "react";
import { useDismissOnOutside } from "@/hooks/use-dismiss-on-outside";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { MathEditorPanel } from "./math-editor-panel";
import { useMathEditor } from "./state";

/**
 * Block math rendered with KaTeX. Clicking it in an editable editor expands
 * the formula editing panel in its place.
 */
export function BlockMathView({
  editor,
  node,
  getPos,
  extension,
}: ReactNodeViewProps) {
  const latex = String(node.attrs.latex ?? "");
  const katexOptions = (extension.options as { katexOptions?: KatexOptions })
    .katexOptions;
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        ...katexOptions,
        displayMode: true,
        throwOnError: false,
      }),
    [latex, katexOptions],
  );

  const open = useMathEditor(editor);
  const editing = open !== null && open.pos === getPos();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  useDismissOnOutside(
    wrapperRef,
    () => editor.commands.closeMathEditor(),
    editing,
  );

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      data-type="block-math"
      data-latex={latex}
      className={cn(
        "tiptap-mathematics-render",
        editor.isEditable && "tiptap-mathematics-render--editable",
      )}
    >
      {editing && open ? (
        <div
          role="group"
          aria-label={
            open.inserted ? m.editor_formula_insert() : m.editor_formula_edit()
          }
          className="rounded-xl p-2 ring-1 ring-(--fuwari-input-border)"
        >
          <MathEditorPanel
            latex={open.latex}
            type={open.type}
            inputRef={inputRef}
            onApply={(value, type) => editor.commands.applyMath(value, type)}
            onCancel={() => {
              editor.commands.closeMathEditor();
              editor.commands.focus();
            }}
          />
        </div>
      ) : (
        <div
          className="block-math-inner"
          onClick={() => {
            const pos = getPos();
            if (typeof pos === "number") editor.commands.openMathEditor(pos);
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
}
