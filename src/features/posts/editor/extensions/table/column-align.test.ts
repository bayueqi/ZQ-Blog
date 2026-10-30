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

function cursorIn(target: Editor, text: string) {
  target.view.dispatch(
    target.state.tr.setSelection(
      TextSelection.create(target.state.doc, cellPos(target, text) + 2),
    ),
  );
}

/** Each row's cell alignments, `-` for the default. */
function alignments(target: Editor) {
  const rows: string[] = [];
  target.state.doc.descendants((node) => {
    if (node.type.name !== "tableRow") return true;
    const cells: string[] = [];
    node.forEach((cell) => cells.push(cell.attrs.align ?? "-"));
    rows.push(cells.join(" "));
    return false;
  });
  return rows;
}

it("keeps the alignment of pasted HTML cells and shows it", () => {
  editor = createPostEditor({
    content:
      '<table><tr><th style="text-align: center"><p>A</p></th>' +
      '<th align="right"><p>B</p></th><th><p>C</p></th></tr>' +
      '<tr><td align="center"><p>1</p></td><td style="text-align:right">' +
      "<p>2</p></td><td><p>3</p></td></tr></table>",
  });

  expect(alignments(editor)).toEqual(["center right -", "center right -"]);
  const shown = [...editor.view.dom.querySelectorAll("th, td")].map(
    (cell) => (cell as HTMLElement).style.textAlign,
  );
  expect(shown).toEqual(["center", "right", "", "center", "right", ""]);
});

it("shows stored alignment in a read-only view", () => {
  editor = createPostEditor({
    editable: false,
    content: {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: ["right", null].map((align) => ({
                type: "tableCell",
                attrs: { align },
                content: [{ type: "paragraph" }],
              })),
            },
          ],
        },
      ],
    },
  });

  const shown = [...editor.view.dom.querySelectorAll("td")].map(
    (cell) => cell.style.textAlign,
  );
  expect(shown).toEqual(["right", ""]);
});

it("aligns the cursor's column across every row", () => {
  const target = openTable();
  cursorIn(target, "b2");

  expect(target.commands.toggleColumnAlign("center")).toBe(true);

  expect(alignments(target)).toEqual([
    "- center -",
    "- center -",
    "- center -",
  ]);
});

it("returns a column to the default when its alignment is chosen again", () => {
  const target = openTable();
  cursorIn(target, "b2");
  target.commands.toggleColumnAlign("right");

  cursorIn(target, "b3");
  target.commands.toggleColumnAlign("right");

  expect(alignments(target)).toEqual(["- - -", "- - -", "- - -"]);
});

it("aligns every column a cell selection spans, until they all match", () => {
  const target = openTable();
  cursorIn(target, "b1");
  target.commands.toggleColumnAlign("center");
  target.view.dispatch(
    target.state.tr.setSelection(
      CellSelection.create(
        target.state.doc,
        cellPos(target, "b1"),
        cellPos(target, "c2"),
      ),
    ),
  );

  target.commands.toggleColumnAlign("center");
  expect(alignments(target)).toEqual([
    "- center center",
    "- center center",
    "- center center",
  ]);

  target.commands.toggleColumnAlign("center");
  expect(alignments(target)).toEqual(["- - -", "- - -", "- - -"]);
});

it("gives added rows their columns' alignment", () => {
  const target = openTable();
  cursorIn(target, "b2");
  target.commands.toggleColumnAlign("center");
  cursorIn(target, "c2");
  target.commands.toggleColumnAlign("right");

  cursorIn(target, "c3");
  pressKey(target, "Tab");
  cursorIn(target, "b2");
  target.commands.addRowBefore();
  cursorIn(target, "a1");
  target.commands.addRowAfter();

  expect(alignments(target)).toEqual(Array(6).fill("- center right"));
});
