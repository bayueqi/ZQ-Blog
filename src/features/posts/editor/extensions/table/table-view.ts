import { TableView, updateColumns } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { tableColumnLayout } from "@/features/posts/editor/extensions/table/column-widths";

/**
 * Applies a table's column layout to its DOM: stored widths as percentages of
 * a full-width fixed table (the CSS for `data-column-widths` does the rest),
 * or Tiptap's content-sized columns when no width is stored.
 */
export function showColumnLayout(
  node: ProseMirrorNode,
  colgroup: HTMLTableColElement,
  table: HTMLTableElement,
  cellMinWidth: number,
) {
  const layout = tableColumnLayout(node);
  if (!layout) {
    table.removeAttribute("data-column-widths");
    updateColumns(node, colgroup, table, cellMinWidth);
    return;
  }

  table.setAttribute("data-column-widths", "");
  table.style.width = "";
  table.style.minWidth = layout.minWidth;
  const cols = [...colgroup.children] as Array<HTMLTableColElement>;
  layout.widths.forEach((width, index) => {
    const col =
      cols[index] ?? colgroup.appendChild(document.createElement("col"));
    col.style.cssText = `width: ${width}`;
  });
  for (const extra of cols.slice(layout.widths.length)) extra.remove();
}

/**
 * The table node view for the editable editor (where prosemirror-tables'
 * column resizing creates it) and the read-only Post Revision view. It shows
 * stored widths with the same proportions the public page uses (ADR 0028).
 */
export class ProportionalTableView extends TableView {
  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    view?: EditorView,
    HTMLAttributes?: Record<string, unknown>,
  ) {
    super(node, cellMinWidth, view, HTMLAttributes);
    showColumnLayout(node, this.colgroup, this.table, cellMinWidth);
  }

  override update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    showColumnLayout(node, this.colgroup, this.table, this.cellMinWidth);
    return true;
  }
}
