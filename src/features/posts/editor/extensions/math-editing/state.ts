import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Step } from "@tiptap/pm/transform";
import { createInPlaceEditing, useInPlaceEditing } from "../in-place-editing";
import { mapSteps } from "../insertion";

export type MathType = "inline" | "block";

/** The formula open for editing. */
export interface MathEditorState {
  /** Where the formula node is. */
  pos: number;
  type: MathType;
  /** Its LaTeX as it was when editing opened. */
  latex: string;
  /** Whether it was just inserted; cancelling takes the insertion back then. */
  inserted: boolean;
  /**
   * The steps that take the insertion back, giving back the text it replaced:
   * empty unless `inserted`.
   */
  revert: readonly Step[];
}

export const NODE_NAMES: Record<MathType, string> = {
  inline: "inlineMath",
  block: "blockMath",
};

export function mathTypeOf(node: PMNode | null | undefined): MathType | null {
  if (node?.type.name === NODE_NAMES.inline) return "inline";
  if (node?.type.name === NODE_NAMES.block) return "block";
  return null;
}

/** The formula open for editing, following it; closed once it is gone. */
export const mathEditor = createInPlaceEditing<MathEditorState>(
  "mathEditing",
  (open, tr) => {
    const mapped = tr.mapping.mapResult(open.pos, 1);
    if (mapped.deletedAfter || !mathTypeOf(tr.doc.nodeAt(mapped.pos))) {
      return null;
    }
    if (mapped.pos === open.pos && open.revert.length === 0) return open;
    return {
      ...open,
      pos: mapped.pos,
      revert: mapSteps(open.revert, tr.mapping),
    };
  },
);

/** The formula open for editing, or `null` when none is. */
export function getMathEditor(editor: Editor): MathEditorState | null {
  return mathEditor.get(editor.state);
}

/** The formula open for editing, re-rendering as it opens, moves or closes. */
export function useMathEditor(editor: Editor | null) {
  return useInPlaceEditing(editor, mathEditor);
}
