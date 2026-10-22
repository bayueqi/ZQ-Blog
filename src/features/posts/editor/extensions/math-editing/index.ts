import type { Editor } from "@tiptap/core";
import { Extension, InputRule } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { Transaction } from "@tiptap/pm/state";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { Transform } from "@tiptap/pm/transform";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { KatexOptions } from "katex";
import { findNode, revertSteps } from "../insertion";
import { BlockMathView } from "./block-math-view";
import type { MathType } from "./state";
import { mathEditor, mathTypeOf, NODE_NAMES } from "./state";
import { BLOCK_MATH_LINE, findInlineMathAtEnd } from "./syntax";

export type { MathEditorState, MathType } from "./state";
export { getMathEditor, useMathEditor } from "./state";

const KATEX_OPTIONS: KatexOptions = { throwOnError: false };

/** Inline math that typing `$latex$` creates. */
const EditorInlineMath = InlineMath.extend({
  addInputRules() {
    return [
      new InputRule({
        find: (text) => {
          const match = findInlineMathAtEnd(text);
          return match && { ...match, data: { latex: match.latex } };
        },
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(
            range.from,
            range.to,
            this.type.create({ latex: match.data?.latex }),
          );
        },
      }),
    ];
  },

  addNodeView() {
    const render = this.parent?.();
    const editor = this.editor;
    if (!render) return null;
    return (props) => {
      const view = render(props);
      const open = (event: Event) => {
        const pos = props.getPos();
        if (typeof pos !== "number") return;
        if (editor.commands.openMathEditor(pos)) event.preventDefault();
      };
      view.dom.addEventListener("click", open);
      return {
        ...view,
        destroy: () => {
          view.dom.removeEventListener("click", open);
          view.destroy?.();
        },
      };
    };
  },
});

/** Block math that typing `$$latex$$` on an empty line creates. */
const EditorBlockMath = BlockMath.extend({
  addInputRules() {
    return [
      new InputRule({
        find: BLOCK_MATH_LINE,
        handler: ({ state, range, match }) => {
          const latex = match[1]?.trim();
          const $from = state.doc.resolve(range.from);
          const wholeLine =
            range.from === $from.start() && range.to === $from.end();
          if (!latex || !wholeLine) return null;
          const host = $from.node(-1);
          if (
            !host.canReplaceWith(
              $from.index(-1),
              $from.indexAfter(-1),
              this.type,
            )
          ) {
            return null;
          }

          const { tr } = state;
          const pos = $from.before();
          tr.replaceWith(pos, $from.after(), this.type.create({ latex }));
          // Writing goes on below, on a new line when there is none.
          if (!tr.doc.nodeAt(pos + 1)?.isTextblock) {
            tr.insert(pos + 1, state.schema.nodes.paragraph.create());
          }
          tr.setSelection(TextSelection.create(tr.doc, pos + 2));
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView, {
      // The in-place editing panel handles its own events.
      stopEvent: ({ event }) =>
        event.target instanceof Element &&
        event.target.closest("[data-math-editor]") !== null,
    });
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathEditing: {
      /**
       * Replaces the selection with a formula of `type` and opens it for
       * editing. Its LaTeX is `latex`, or else the selected text.
       */
      insertMath: (type: MathType, latex?: string) => ReturnType;
      /** Opens the formula at `pos` for editing. */
      openMathEditor: (pos: number) => ReturnType;
      /**
       * Applies the open formula as `latex` shown as `type`, removes it when
       * `latex` is blank, and closes the editing.
       */
      applyMath: (latex: string, type: MathType) => ReturnType;
      /**
       * Closes the editing without changing the formula, or removes it when
       * it was just inserted.
       */
      closeMathEditor: () => ReturnType;
    };
  }
}

/** Selects the formula at `pos`: the cursor after inline math, block math whole. */
function selectFormula(tr: Transaction, pos: number) {
  const node = tr.doc.nodeAt(pos);
  if (!node) return;
  tr.setSelection(
    node.isInline
      ? TextSelection.create(tr.doc, pos + node.nodeSize)
      : NodeSelection.create(tr.doc, pos),
  );
}

function focusSoon(editor: Editor) {
  // After the editing UI unmounts, as Tiptap's focus command does.
  requestAnimationFrame(() => {
    if (!editor.isDestroyed) editor.view.focus();
  });
}

/**
 * Inline and block math, typed as `$latex$` and `$$latex$$` and edited in
 * place: clicking a formula, or inserting one from the toolbar or slash menu,
 * opens it for editing, which the `Editor` component renders. Never opens in
 * a read-only editor.
 */
export const MathEditing = Extension.create({
  name: "mathEditing",

  addExtensions() {
    return [
      EditorInlineMath.configure({ katexOptions: KATEX_OPTIONS }),
      EditorBlockMath.configure({ katexOptions: KATEX_OPTIONS }),
    ];
  },

  addProseMirrorPlugins() {
    return [mathEditor.plugin()];
  },

  addCommands() {
    return {
      insertMath:
        (type, latex) =>
        ({ editor, tr, dispatch }) => {
          const nodeType = tr.doc.type.schema.nodes[NODE_NAMES[type]];
          if (!editor.isEditable || !nodeType) return false;
          if (!dispatch) return true;

          const start = tr.steps.length;
          const { from, to, empty, $from } = tr.selection;
          const text = (latex ?? tr.doc.textBetween(from, to, " ")).trim();
          const node = nodeType.create({ latex: text });
          const host = $from.depth > 0 ? $from.node(-1) : null;
          const replacesEmptyLine =
            type === "block" &&
            empty &&
            $from.parent.isTextblock &&
            $from.parent.content.size === 0 &&
            host?.canReplaceWith(
              $from.index(-1),
              $from.indexAfter(-1),
              nodeType,
            );
          if (replacesEmptyLine) {
            tr.replaceWith($from.before(), $from.after(), node);
          } else {
            tr.replaceSelectionWith(node, false);
          }

          const pos = findNode(tr, node);
          if (pos < 0) return false;
          selectFormula(tr, pos);
          mathEditor.open(tr, {
            pos,
            type,
            latex: text,
            inserted: true,
            revert: revertSteps(tr, start),
          });
          return true;
        },
      openMathEditor:
        (pos) =>
        ({ editor, state, tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          const type = mathTypeOf(node);
          if (!editor.isEditable || !type) return false;
          // Clicking the open formula again keeps its editing as it is.
          if (dispatch && mathEditor.get(state)?.pos !== pos) {
            mathEditor.open(tr, {
              pos,
              type,
              latex: String(node?.attrs.latex ?? ""),
              inserted: false,
              revert: [],
            });
          }
          return true;
        },
      applyMath:
        (latex, type) =>
        ({ editor, state, tr, dispatch }) => {
          const open = mathEditor.get(state);
          if (!open) return false;
          if (!dispatch) return true;
          mathEditor.close(tr);

          const node = tr.doc.nodeAt(open.pos);
          const nodeType = tr.doc.type.schema.nodes[NODE_NAMES[type]];
          if (!node || !mathTypeOf(node) || !nodeType) return true;
          const text = latex.trim();
          if (!text) {
            tr.delete(open.pos, open.pos + node.nodeSize);
          } else if (node.type === nodeType) {
            tr.setNodeMarkup(open.pos, undefined, {
              ...node.attrs,
              latex: text,
            });
            selectFormula(tr, open.pos);
          } else {
            const next = nodeType.create({ latex: text });
            tr.replaceRangeWith(open.pos, open.pos + node.nodeSize, next);
            const pos = findNode(tr, next);
            if (pos >= 0) selectFormula(tr, pos);
          }
          focusSoon(editor);
          return true;
        },
      closeMathEditor:
        () =>
        ({ state, tr, dispatch }) => {
          const open = mathEditor.get(state);
          if (!open) return false;
          if (!dispatch) return true;
          mathEditor.close(tr);
          const node = tr.doc.nodeAt(open.pos);
          if (!open.inserted || !mathTypeOf(node)) return true;
          // Give back what the formula replaced, or else just remove it.
          const reverted = new Transform(tr.doc);
          const restored =
            open.revert.length > 0 &&
            open.revert.every((step) => !reverted.maybeStep(step).failed);
          if (restored) {
            for (const step of reverted.steps) tr.step(step);
          } else if (node) {
            tr.delete(open.pos, open.pos + node.nodeSize);
          }
          return true;
        },
    };
  },
});
