interface Box {
  top: number;
}

/** Room the menu needs above its anchor: its height plus the gap. */
const MENU_CLEARANCE = 48;

/**
 * What the table menu sits above, aligned to its right edge: the table, so it
 * never covers a row or the column borders being dragged, or the active cell
 * once the table's top has scrolled out of view.
 */
export function tableMenuAnchor<T extends Box>({
  table,
  cell,
  visibleTop,
}: {
  table: T;
  cell: T;
  visibleTop: number;
}): T {
  return table.top - MENU_CLEARANCE >= visibleTop ? table : cell;
}
