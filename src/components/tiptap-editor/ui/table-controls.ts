import {
  columnIsHeader,
  findTable,
  rowIsHeader,
  TableMap,
} from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  PanelLeft,
  PanelTop,
  Rows3,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
} from "lucide-react";
import type { ColumnAlign } from "@/features/posts/editor/extensions/table/column-align";
import { columnAlignment } from "@/features/posts/editor/extensions/table/column-align";
import { m } from "@/paraglide/messages";

/** One thing the table menu can do to the table the selection is in. */
export interface TableAction {
  /** Stable key, unique across the whole menu. */
  id: string;
  /** What it does, shown as its text or tooltip. */
  label: () => string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
  /** Hidden unless this holds, e.g. merging only on a multi-cell selection. */
  available?: (editor: Editor) => boolean;
  /** Makes the action a toggle; whether it is on. */
  active?: (editor: Editor) => boolean;
  destructive?: boolean;
}

/**
 * A run of the table menu, separated from its neighbours. A `menu` is a
 * labelled dropdown of its actions; `buttons` shows each action as a button
 * with its text, or only its icon when `iconOnly` (for a set like alignment
 * whose icons speak for themselves).
 */
export type TableControlGroup =
  | { kind: "menu"; id: string; label: () => string; actions: TableAction[] }
  | {
      kind: "buttons";
      id: string;
      actions: TableAction[];
      iconOnly?: boolean;
    };

function selectedTable(editor: Editor) {
  const table = findTable(editor.state.selection.$from);
  return table ? { node: table.node, map: TableMap.get(table.node) } : null;
}

function headerRowOn(editor: Editor) {
  const table = selectedTable(editor);
  return !!table && rowIsHeader(table.map, table.node, 0);
}

function headerColumnOn(editor: Editor) {
  const table = selectedTable(editor);
  return !!table && columnIsHeader(table.map, table.node, 0);
}

function alignAction(
  align: ColumnAlign,
  label: () => string,
  icon: LucideIcon,
): TableAction {
  return {
    id: `align-${align}`,
    label,
    icon,
    run: (editor) => editor.chain().focus().toggleColumnAlign(align).run(),
    active: (editor) => columnAlignment(editor.state) === align,
  };
}

/** The table menu, in order. Add a group here to add it to every layout. */
export const TABLE_CONTROL_GROUPS: TableControlGroup[] = [
  {
    kind: "menu",
    id: "row",
    label: m.editor_table_row_menu,
    actions: [
      {
        id: "add-row-before",
        label: m.editor_table_add_row_before,
        icon: ArrowUpToLine,
        run: (editor) => editor.chain().focus().addRowBefore().run(),
      },
      {
        id: "add-row-after",
        label: m.editor_table_add_row_after,
        icon: ArrowDownToLine,
        run: (editor) => editor.chain().focus().addRowAfter().run(),
      },
      {
        id: "header-row",
        label: m.editor_table_toggle_header_row,
        icon: PanelTop,
        run: (editor) => editor.chain().focus().toggleHeaderRow().run(),
        active: headerRowOn,
      },
      {
        id: "delete-row",
        label: m.editor_table_delete_row,
        icon: Rows3,
        run: (editor) => editor.chain().focus().deleteRow().run(),
        destructive: true,
      },
    ],
  },
  {
    kind: "menu",
    id: "column",
    label: m.editor_table_col_menu,
    actions: [
      {
        id: "add-col-before",
        label: m.editor_table_add_col_before,
        icon: ArrowLeftToLine,
        run: (editor) => editor.chain().focus().addColumnBefore().run(),
      },
      {
        id: "add-col-after",
        label: m.editor_table_add_col_after,
        icon: ArrowRightToLine,
        run: (editor) => editor.chain().focus().addColumnAfter().run(),
      },
      {
        id: "header-col",
        label: m.editor_table_toggle_header_col,
        icon: PanelLeft,
        run: (editor) => editor.chain().focus().toggleHeaderColumn().run(),
        active: headerColumnOn,
      },
      {
        id: "delete-col",
        label: m.editor_table_delete_col,
        icon: Columns3,
        run: (editor) => editor.chain().focus().deleteColumn().run(),
        destructive: true,
      },
    ],
  },
  {
    kind: "buttons",
    id: "cells",
    actions: [
      {
        id: "merge-cells",
        label: m.editor_table_merge_cells,
        icon: TableCellsMerge,
        run: (editor) => editor.chain().focus().mergeCells().run(),
        available: (editor) => editor.can().mergeCells(),
      },
      {
        id: "split-cell",
        label: m.editor_table_split_cell,
        icon: TableCellsSplit,
        run: (editor) => editor.chain().focus().splitCell().run(),
        available: (editor) => editor.can().splitCell(),
      },
    ],
  },
  {
    kind: "buttons",
    id: "align",
    iconOnly: true,
    actions: [
      alignAction("left", m.editor_table_align_left, AlignLeft),
      alignAction("center", m.editor_table_align_center, AlignCenter),
      alignAction("right", m.editor_table_align_right, AlignRight),
    ],
  },
  {
    kind: "buttons",
    id: "table",
    actions: [
      {
        id: "delete-table",
        label: m.editor_table_delete_table,
        icon: Trash2,
        run: (editor) => editor.chain().focus().deleteTable().run(),
        destructive: true,
      },
    ],
  },
];

/**
 * What the menu shows for the current selection: each action's availability
 * and toggle state, keyed by action id. Read inside `useEditorState`, so the
 * menu re-renders only when one of them changes.
 */
export function tableControlState(editor: Editor) {
  const state: Record<string, { available: boolean; active?: boolean }> = {};
  for (const group of TABLE_CONTROL_GROUPS) {
    for (const action of group.actions) {
      state[action.id] = {
        available: action.available?.(editor) ?? true,
        active: action.active?.(editor),
      };
    }
  }
  return state;
}
