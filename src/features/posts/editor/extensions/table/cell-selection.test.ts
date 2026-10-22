// @vitest-environment jsdom
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { afterEach, expect, it } from "vitest";
import { createPostEditor, pressKey } from "@/features/posts/editor/test-utils";

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

/** A 3x3 table whose cells read a1 b1 c1 / a2 b2 c2 / a3 b3 c3. */
function openTable() {
  const rows = [1, 2, 3].map(
    (row) =>
      `<tr>${["a", "b", "c"].map((col) => `<td><p>${col}${row}</p></td>`).join("")}</tr>`,
  );
  editor = createPostEditor({ content: `<table>${rows.join("")}</table>` });
  return editor;
}

/** Where the cell showing `text` starts. */
function cellPos(target: Editor, text: string) {
  let found: number | null = null;
  target.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableCell" && node.textContent === text) {
      found = pos;
    }
  });
  if (found === null) throw new Error(`No cell shows "${text}"`);
  return found;
}

/** Puts the cursor at the end of the cell showing `text`. */
function cursorAtEndOf(target: Editor, text: string) {
  const cell = target.state.doc.nodeAt(cellPos(target, text));
  const end = cellPos(target, text) + (cell?.nodeSize ?? 0) - 2;
  target.view.dispatch(
    target.state.tr.setSelection(TextSelection.create(target.state.doc, end)),
  );
}

/** The text of every selected cell, in table order. */
function selectedCells(target: Editor) {
  const { selection } = target.state;
  if (!(selection instanceof CellSelection)) return [];
  const texts: string[] = [];
  selection.forEachCell((cell) => texts.push(cell.textContent));
  return texts;
}

it("extends a cell selection with Shift+Arrow from the end of a cell", () => {
  const target = openTable();
  cursorAtEndOf(target, "a1");

  pressKey(target, "ArrowRight", { shiftKey: true });
  expect(selectedCells(target)).toEqual(["a1", "b1"]);

  pressKey(target, "ArrowDown", { shiftKey: true });
  expect(selectedCells(target)).toEqual(["a1", "b1", "a2", "b2"]);
});

it("keeps the cell selection when Shift+Arrow reaches the table's edge", () => {
  const target = openTable();
  cursorAtEndOf(target, "b2");
  pressKey(target, "ArrowRight", { shiftKey: true });
  expect(selectedCells(target)).toEqual(["b2", "c2"]);

  // Unhandled, the browser would move a native selection out of the table.
  expect(pressKey(target, "ArrowRight", { shiftKey: true })).toBe(true);
  expect(selectedCells(target)).toEqual(["b2", "c2"]);

  pressKey(target, "ArrowDown", { shiftKey: true });
  expect(pressKey(target, "ArrowDown", { shiftKey: true })).toBe(true);
  expect(selectedCells(target)).toEqual(["b2", "c2", "b3", "c3"]);
});

/** Each row's cells as `text colspan×rowspan`. */
function layout(target: Editor) {
  const table = target.state.doc.firstChild;
  const rows: string[][] = [];
  table?.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) =>
      cells.push(
        `${cell.textContent} ${cell.attrs.colspan}×${cell.attrs.rowspan}`,
      ),
    );
    rows.push(cells);
  });
  return rows;
}

it("merges a keyboard cell selection into one cell and splits it back", () => {
  const target = openTable();
  cursorAtEndOf(target, "a1");
  pressKey(target, "ArrowRight", { shiftKey: true });
  pressKey(target, "ArrowDown", { shiftKey: true });

  expect(target.can().mergeCells()).toBe(true);
  expect(target.can().splitCell()).toBe(false);
  target.commands.mergeCells();
  expect(layout(target)).toEqual([
    ["a1b1a2b2 2×2", "c1 1×1"],
    ["c2 1×1"],
    ["a3 1×1", "b3 1×1", "c3 1×1"],
  ]);

  expect(target.can().splitCell()).toBe(true);
  target.commands.splitCell();
  expect(layout(target)).toEqual([
    ["a1b1a2b2 1×1", " 1×1", "c1 1×1"],
    [" 1×1", " 1×1", "c2 1×1"],
    ["a3 1×1", "b3 1×1", "c3 1×1"],
  ]);
});

function selectCells(target: Editor, from: string, to: string) {
  target.view.dispatch(
    target.state.tr.setSelection(
      CellSelection.create(
        target.state.doc,
        cellPos(target, from),
        cellPos(target, to),
      ),
    ),
  );
}

it.each(["Backspace", "Delete"])(
  "deletes the whole table with %s when every cell is selected",
  (key) => {
    const target = openTable();
    selectCells(target, "a1", "c3");

    expect(pressKey(target, key)).toBe(true);
    expect(target.state.doc.firstChild?.type.name).not.toBe("table");
    expect(target.getHTML()).not.toContain("<table");
  },
);

it("deletes the table once Shift+Arrow has selected every cell", () => {
  const target = openTable();
  cursorAtEndOf(target, "a1");
  for (const key of ["ArrowRight", "ArrowDown"]) {
    for (let press = 0; press < 3; press += 1) {
      pressKey(target, key, { shiftKey: true });
    }
  }
  expect(selectedCells(target)).toHaveLength(9);

  pressKey(target, "Delete");
  expect(target.getHTML()).not.toContain("<table");
});

it("deletes a table with merged cells when every cell is selected", () => {
  const target = openTable();
  selectCells(target, "a1", "b2");
  target.commands.mergeCells();
  selectCells(target, "a1b1a2b2", "c3");

  expect(pressKey(target, "Backspace")).toBe(true);
  expect(target.getHTML()).not.toContain("<table");
});

it("only clears the selected cells when some are left out", () => {
  const target = openTable();
  selectCells(target, "a1", "c2");

  pressKey(target, "Backspace");
  expect(layout(target).map((row) => row.map((cell) => cell.trim()))).toEqual([
    ["1×1", "1×1", "1×1"],
    ["1×1", "1×1", "1×1"],
    ["a3 1×1", "b3 1×1", "c3 1×1"],
  ]);
});

it("selects the cell itself when Shift+Arrow leaves it at the table's edge", () => {
  const target = openTable();
  cursorAtEndOf(target, "c1");

  expect(pressKey(target, "ArrowRight", { shiftKey: true })).toBe(true);
  expect(selectedCells(target)).toEqual(["c1"]);

  pressKey(target, "ArrowDown", { shiftKey: true });
  expect(selectedCells(target)).toEqual(["c1", "c2"]);
});
