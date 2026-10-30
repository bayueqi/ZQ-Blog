// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type { Editor, JSONContent } from "@tiptap/core";
import { findInPopover } from "tests/popover";
import { afterEach, expect, it, vi } from "vitest";
import {
  pressKey,
  renderPostEditor,
  typeText,
} from "@/features/posts/editor/test-utils";
import { m } from "@/paraglide/messages";

// Unmount popovers as soon as they close; exit motion is not under test.
vi.mock("@/hooks/use-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-motion")>()),
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

function picker() {
  return screen.queryByRole("dialog", { name: m.editor_toolbar_table() });
}

/** Each table in the document as its rows of cell types. */
function tables(editor: Editor) {
  return (editor.getJSON().content ?? [])
    .filter((node: JSONContent) => node.type === "table")
    .map((table: JSONContent) =>
      (table.content ?? []).map((row: JSONContent) =>
        (row.content ?? []).map((cell: JSONContent) =>
          cell.type === "tableHeader" ? "th" : "td",
        ),
      ),
    );
}

function tableOf(cols: number, rows: number) {
  return [
    Array.from({ length: cols }, () => "th"),
    ...Array.from({ length: rows - 1 }, () =>
      Array.from({ length: cols }, () => "td"),
    ),
  ];
}

async function openPicker() {
  const view = await renderPostEditor({ content: "<p>a</p>" });
  act(() => {
    fireEvent.click(
      screen.getByRole("button", { name: m.editor_toolbar_table() }),
    );
  });
  const dialog = await findInPopover("dialog", {
    name: m.editor_toolbar_table(),
  });
  return { ...view, dialog };
}

it("opens a size picker from the toolbar instead of inserting a table", async () => {
  const { editor, dialog } = await openPicker();

  expect(tables(editor)).toEqual([]);
  expect(screen.getAllByRole("gridcell")).toHaveLength(64);
  expect(dialog.textContent).toContain("1 × 1");
});

it("chooses the size with the arrow keys and inserts it on Enter", async () => {
  const { editor } = await openPicker();
  const grid = screen.getByRole("grid");
  expect(document.activeElement).toBe(grid);

  act(() => {
    for (let i = 0; i < 3; i++) fireEvent.keyDown(grid, { key: "ArrowRight" });
    for (let i = 0; i < 4; i++) fireEvent.keyDown(grid, { key: "ArrowDown" });
  });
  expect(picker()?.textContent).toContain("4 × 5");
  act(() => {
    fireEvent.keyDown(grid, { key: "Enter" });
  });

  expect(tables(editor)).toEqual([tableOf(4, 5)]);
  expect(picker()).toBeNull();
});

it("highlights the hovered size and inserts it on click", async () => {
  const { editor } = await openPicker();
  const cell = screen.getByRole("gridcell", {
    name: m.editor_toolbar_table_size({ cols: 4, rows: 5 }),
  });

  act(() => {
    fireEvent.mouseEnter(cell);
  });
  expect(picker()?.textContent).toContain("4 × 5");
  expect(
    screen
      .getAllByRole("gridcell")
      .filter((gridcell) => gridcell.getAttribute("aria-selected") === "true"),
  ).toHaveLength(20);
  act(() => {
    fireEvent.click(cell);
  });

  expect(tables(editor)).toEqual([tableOf(4, 5)]);
  expect(picker()).toBeNull();
});

it("stops at 8 × 8", async () => {
  const { editor } = await openPicker();
  const grid = screen.getByRole("grid");

  act(() => {
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      fireEvent.keyDown(grid, { key: "ArrowDown" });
    }
  });
  expect(picker()?.textContent).toContain("8 × 8");
  act(() => {
    for (let i = 0; i < 10; i++) fireEvent.keyDown(grid, { key: "ArrowLeft" });
  });
  act(() => {
    fireEvent.keyDown(grid, { key: "Enter" });
  });

  expect(tables(editor)).toEqual([tableOf(1, 8)]);
});

it("closes on Escape without inserting and returns focus to the button", async () => {
  const { editor } = await openPicker();

  act(() => {
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Escape" });
  });

  expect(picker()).toBeNull();
  expect(tables(editor)).toEqual([]);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: m.editor_toolbar_table() }),
  );
});

it("closes on a click elsewhere without inserting", async () => {
  const { editor } = await openPicker();

  act(() => {
    fireEvent.mouseDown(document.body);
  });

  expect(picker()).toBeNull();
  expect(tables(editor)).toEqual([]);
});

it("offers no table picker in a read-only editor", async () => {
  await renderPostEditor({ content: "<p>a</p>", editable: false });

  expect(
    screen.queryByRole("button", { name: m.editor_toolbar_table() }),
  ).toBeNull();
  expect(picker()).toBeNull();
});

it("still inserts a 3 × 3 table from the slash menu", async () => {
  const { editor } = await renderPostEditor({ content: "<p></p>" });
  act(() => {
    editor.commands.focus("end");
  });

  act(() => typeText(editor, "/table"));
  await findInPopover("listbox", { name: m.editor_slash_menu() });
  act(() => {
    pressKey(editor, "Enter");
  });

  expect(tables(editor)).toEqual([tableOf(3, 3)]);
  expect(picker()).toBeNull();
});
