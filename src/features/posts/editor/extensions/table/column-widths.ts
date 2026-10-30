import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";

/**
 * How a table's stored column widths are shown (ADR 0028). Tiptap stores
 * pixel widths per cell (`colwidth`, one entry per spanned column); the editor
 * and the public page both read them as proportions of a full-width table.
 */
export interface TableColumnLayout {
  /** CSS width of each column, as a percentage of the table. */
  widths: Array<string>;
  /**
   * CSS min-width of the table: enough for the narrowest column to get
   * `MIN_COLUMN_REM`, but never more than `MAX_MIN_WIDTH_SHARE` of the stored
   * pixel layout. Below it the table scrolls sideways instead of squeezing
   * columns.
   */
  minWidth: string;
}

/** The width the narrowest column keeps on narrow screens. */
export const MIN_COLUMN_REM = 5;

/**
 * The most of its stored layout a table may insist on. Tables are laid out in
 * the editor, which is wider than the published article; a column dragged to
 * the minimum would otherwise make the table demand its whole editor width and
 * scroll on desktop.
 */
export const MAX_MIN_WIDTH_SHARE = 2 / 3;

/** The layout for a table, or `null` when no column has a stored width. */
export function tableColumnLayout(
  table: ProseMirrorNode,
): TableColumnLayout | null {
  const stored = storedColumnWidths(table);
  if (stored.every((width) => width === null)) return null;

  // A column without a stored width counts as an average stored column.
  const set = stored.filter((width) => width !== null);
  const average = set.reduce((sum, width) => sum + width, 0) / set.length;
  const resolved = stored.map((width) => width ?? average);
  const total = resolved.reduce((sum, width) => sum + width, 0);
  const narrowest = Math.min(...resolved) / total;
  return {
    widths: resolved.map((width) => percent(width / total)),
    minWidth: `min(${round(MIN_COLUMN_REM / narrowest)}rem, ${round(total * MAX_MIN_WIDTH_SHARE)}px)`,
  };
}

/** The stored pixel width of every column, or `null` where none is stored. */
function storedColumnWidths(table: ProseMirrorNode): Array<number | null> {
  const map = TableMap.get(table);
  const widths: Array<number | null> = Array.from(
    { length: map.width },
    () => null,
  );
  for (let col = 0; col < map.width; col += 1) {
    for (let row = 0; row < map.height; row += 1) {
      const pos = map.map[row * map.width + col];
      const cell = table.nodeAt(pos);
      const colwidth = cell?.attrs.colwidth as Array<number> | null | undefined;
      const width = colwidth?.[col - map.colCount(pos)];
      if (width && width > 0) {
        widths[col] = width;
        break;
      }
    }
  }
  return widths;
}

function percent(share: number): string {
  return `${round(share * 100)}%`;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Drags the border between column `col` and the next one: `col` becomes
 * `width` and the next column gives or takes the difference, so a full-width
 * table keeps its total and the other columns stay put. Neither column gets
 * narrower than `minWidth`.
 */
export function resizeColumn(
  widths: ReadonlyArray<number>,
  col: number,
  width: number,
  minWidth: number,
): Array<number> {
  const pair = widths[col] + widths[col + 1];
  const next = Math.min(Math.max(width, minWidth), pair - minWidth);
  const result = [...widths];
  result[col] = next;
  result[col + 1] = pair - next;
  return result;
}
