import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { columnResizingPluginKey, TableMap } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import { resizeColumn } from "@/features/posts/editor/extensions/table/column-widths";
import { showColumnLayout } from "@/features/posts/editor/extensions/table/table-view";

interface DraggedBorder {
  table: ProseMirrorNode;
  tableStart: number;
  map: TableMap;
  /** The column left of the dragged border. */
  col: number;
}

/**
 * Fits prosemirror-tables' column dragging to tables that always fill the
 * content column (ADR 0028). It runs before the built-in handlers:
 *
 * - On pressing a resize handle it stores every column's on-screen width, so
 *   the built-in drag starts from what the Admin sees. That step is left out
 *   of undo history; it does not change how the table looks.
 * - While dragging, the column right of the border absorbs the change (CSS
 *   for `col[data-resize-neighbour]`), so the other columns stay put.
 * - On release it writes the dragged column and its neighbour together.
 */
export function fullWidthColumnDrag(cellMinWidth: number): Plugin {
  return new Plugin({
    key: new PluginKey("fullWidthColumnDrag"),
    props: {
      handleDOMEvents: {
        mousedown: (view, event) => {
          startDrag(view, event, cellMinWidth);
          return false;
        },
      },
    },
  });
}

function startDrag(view: EditorView, event: MouseEvent, cellMinWidth: number) {
  if (!view.editable || event.button !== 0) return;
  const border = draggedBorder(view);
  if (!border) return;
  const widths = measureColumns(view, border);
  if (!widths) return;

  view.dispatch(
    setColumnWidths(view.state.tr, border, widths).setMeta(
      "addToHistory",
      false,
    ),
  );
  const neighbour = tableDom(view, border.tableStart)?.querySelector(
    `:scope > colgroup > col:nth-child(${border.col + 2})`,
  );
  neighbour?.setAttribute("data-resize-neighbour", "");

  const win = view.dom.ownerDocument.defaultView ?? window;
  const finish = (finishEvent: MouseEvent) => {
    win.removeEventListener("mouseup", finish);
    win.removeEventListener("mousemove", move);
    neighbour?.removeAttribute("data-resize-neighbour");
    commitDrag(view, finishEvent, cellMinWidth);
  };
  // Like prosemirror-tables: a move without a pressed button ends the drag.
  const move = (moveEvent: MouseEvent) => {
    if (moveEvent.buttons === 0) finish(moveEvent);
  };
  win.addEventListener("mouseup", finish);
  win.addEventListener("mousemove", move);
}

function commitDrag(view: EditorView, event: MouseEvent, cellMinWidth: number) {
  const dragging = columnResizingPluginKey.getState(view.state)?.dragging;
  const border = draggedBorder(view);
  if (!dragging || !border) return;

  const stored = storedWidths(border);
  if (stored) {
    // The same width prosemirror-tables would store for the dragged column.
    const width = Math.max(
      cellMinWidth,
      dragging.startWidth + event.clientX - dragging.startX,
    );
    const widths = resizeColumn(stored, border.col, width, cellMinWidth);
    view.dispatch(setColumnWidths(view.state.tr, border, widths));
  }
  // End the drag here so the built-in release handler does not store the
  // dragged width a second time without the neighbour.
  view.dispatch(
    view.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }),
  );

  // The built-in preview wrote pixel widths into the DOM; show proportions.
  const after = draggedBorder(view);
  const table = after && tableDom(view, after.tableStart);
  const colgroup =
    table?.querySelector<HTMLTableColElement>(":scope > colgroup");
  if (after && table && colgroup) {
    showColumnLayout(after.table, colgroup, table, cellMinWidth);
  }
}

/** The border under the active resize handle, if it has a column after it. */
function draggedBorder(view: EditorView): DraggedBorder | null {
  const resize = columnResizingPluginKey.getState(view.state);
  if (!resize || resize.activeHandle < 0) return null;
  const $cell = view.state.doc.resolve(resize.activeHandle);
  const cell = $cell.nodeAfter;
  const table = $cell.node(-1);
  if (!cell || table.type.spec.tableRole !== "table") return null;

  const tableStart = $cell.start(-1);
  const map = TableMap.get(table);
  const col =
    map.colCount($cell.pos - tableStart) + (cell.attrs.colspan as number) - 1;
  if (col + 1 >= map.width) return null;
  return { table, tableStart, map, col };
}

/** Each column's width on screen, in whole pixels. */
function measureColumns(
  view: EditorView,
  { table, tableStart, map }: DraggedBorder,
): Array<number> | null {
  const widths: Array<number | null> = Array.from(
    { length: map.width },
    () => null,
  );
  const spanning: Array<{ left: number; right: number; width: number }> = [];
  for (const pos of new Set(map.map)) {
    const dom = view.nodeDOM(tableStart + pos);
    if (!(dom instanceof HTMLElement) || !table.nodeAt(pos)) return null;
    const { left, right } = map.findCell(pos);
    const { width } = dom.getBoundingClientRect();
    if (right - left === 1) widths[left] ??= width;
    else spanning.push({ left, right, width });
  }
  // Columns only ever covered by merged cells share what is left of them.
  for (const { left, right, width } of spanning) {
    const cols = Array.from({ length: right - left }, (_, i) => left + i);
    const known = cols.reduce((sum, col) => sum + (widths[col] ?? 0), 0);
    const unknown = cols.filter((col) => widths[col] === null);
    for (const col of unknown) widths[col] = (width - known) / unknown.length;
  }
  if (widths.some((width) => width === null || width <= 0)) return null;
  return widths.map((width) => Math.round(width ?? 0));
}

/** Every column's stored width, or `null` if any column has none. */
function storedWidths({ table, map }: DraggedBorder): Array<number> | null {
  const widths: Array<number> = [];
  for (let col = 0; col < map.width; col += 1) {
    const pos = map.map[col];
    const colwidth = table.nodeAt(pos)?.attrs.colwidth as
      | Array<number>
      | null
      | undefined;
    const width = colwidth?.[col - map.colCount(pos)];
    if (!width) return null;
    widths.push(width);
  }
  return widths;
}

/** Stores `widths` on every cell, one entry per column it spans. */
function setColumnWidths(
  tr: Transaction,
  { table, tableStart, map }: DraggedBorder,
  widths: ReadonlyArray<number>,
): Transaction {
  for (const pos of new Set(map.map)) {
    const cell = table.nodeAt(pos);
    if (!cell) continue;
    const { left, right } = map.findCell(pos);
    const colwidth = widths.slice(left, right);
    const current = cell.attrs.colwidth as Array<number> | null;
    if (current && colwidth.every((width, i) => current[i] === width)) {
      continue;
    }
    tr.setNodeMarkup(tableStart + pos, undefined, { ...cell.attrs, colwidth });
  }
  return tr;
}

function tableDom(view: EditorView, tableStart: number) {
  const wrapper = view.nodeDOM(tableStart - 1);
  if (!(wrapper instanceof HTMLElement)) return null;
  return wrapper instanceof HTMLTableElement
    ? wrapper
    : wrapper.querySelector<HTMLTableElement>(":scope > table");
}
