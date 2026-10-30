import type { KeyboardShortcutCommand } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection, nextCell } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";

type Axis = "horiz" | "vert";

const DIRECTION = {
  horiz: { [-1]: "left", 1: "right" },
  vert: { [-1]: "up", 1: "down" },
} as const;

/**
 * The cell a text cursor sits at the far edge of, moving along `axis` in
 * `dir`, or null when it can still move inside the cell.
 */
function cellAtEdge(view: EditorView, axis: Axis, dir: -1 | 1) {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection)) return null;
  const { $head } = selection;
  for (let depth = $head.depth - 1; depth >= 0; depth -= 1) {
    const index = dir < 0 ? $head.index(depth) : $head.indexAfter(depth);
    if (index !== (dir < 0 ? 0 : $head.node(depth).childCount)) return null;
    const role = $head.node(depth).type.spec.tableRole;
    if (role === "cell" || role === "header_cell") {
      if (!view.endOfTextblock(DIRECTION[axis][dir])) return null;
      return view.state.doc.resolve($head.before(depth));
    }
  }
  return null;
}

/**
 * Shift+Arrow where the table's own handling gives up: at the table's edge.
 * A cell selection stays as it is instead of the browser moving a native
 * selection out of the table, and a cursor at the edge of an outer cell
 * selects that cell so the next Shift+Arrow can grow the selection.
 */
export function extendCellSelectionAtEdge(
  axis: Axis,
  dir: -1 | 1,
): KeyboardShortcutCommand {
  return ({ editor }) => {
    const { view, state } = editor;
    const { selection } = state;
    let $head: ResolvedPos;
    let next: CellSelection;
    if (selection instanceof CellSelection) {
      $head = selection.$headCell;
      next = selection;
    } else {
      const $cell = cellAtEdge(view, axis, dir);
      if (!$cell) return false;
      $head = $cell;
      next = new CellSelection($cell);
    }
    if (nextCell($head, axis, dir)) return false;
    if (!next.eq(selection)) view.dispatch(state.tr.setSelection(next));
    return true;
  };
}
