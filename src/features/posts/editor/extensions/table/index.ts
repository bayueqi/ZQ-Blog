import { mergeAttributes } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { extendCellSelectionAtEdge } from "@/features/posts/editor/extensions/table/cell-selection";
import type { ColumnAlign } from "@/features/posts/editor/extensions/table/column-align";
import {
  addRowKeepingAlign,
  toggleColumnAlign,
} from "@/features/posts/editor/extensions/table/column-align";
import { fullWidthColumnDrag } from "@/features/posts/editor/extensions/table/full-width-column-drag";
import { ProportionalTableView } from "@/features/posts/editor/extensions/table/table-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columnAlign: {
      /**
       * Aligns the selection's columns in every row; choosing a column's
       * current alignment again returns it to the default.
       */
      toggleColumnAlign: (align: ColumnAlign) => ReturnType;
    };
  }
}

export const TableBlockExtension = [
  Table.extend({
    renderHTML({ HTMLAttributes }) {
      const { style: _style, ...attrs } = HTMLAttributes;
      return [
        "table",
        mergeAttributes(this.options.HTMLAttributes, attrs),
        ["tbody", 0],
      ];
    },
    addCommands() {
      return {
        ...this.parent?.(),
        addRowBefore: () => addRowKeepingAlign("before"),
        addRowAfter: () => addRowKeepingAlign("after"),
        toggleColumnAlign,
      };
    },
    addKeyboardShortcuts() {
      return {
        ...this.parent?.(),
        "Shift-ArrowLeft": extendCellSelectionAtEdge("horiz", -1),
        "Shift-ArrowRight": extendCellSelectionAtEdge("horiz", 1),
        "Shift-ArrowUp": extendCellSelectionAtEdge("vert", -1),
        "Shift-ArrowDown": extendCellSelectionAtEdge("vert", 1),
      };
    },
    addProseMirrorPlugins() {
      const plugins = this.parent?.() ?? [];
      if (!this.options.resizable || !this.editor.isEditable) return plugins;
      // Before columnResizing, so its handlers see the drag first.
      return [fullWidthColumnDrag(this.options.cellMinWidth), ...plugins];
    },
  }).configure({
    // Built-in column dragging in the editable editor; the read-only view
    // gets the same node view without handles (ADR 0028).
    resizable: true,
    cellMinWidth: 48,
    lastColumnResizable: false,
    View: ProportionalTableView,
  }),
  TableRow,
  TableHeader,
  TableCell,
];
