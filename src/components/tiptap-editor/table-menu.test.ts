// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { findInPopover } from "tests/popover";
import { afterEach, expect, it, vi } from "vitest";
import { renderPostEditor } from "@/features/posts/editor/test-utils";
import { m } from "@/paraglide/messages";

// Unmount menus as soon as they close; exit motion is not under test.
vi.mock("@/hooks/use-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-motion")>()),
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

const TABLE =
  "<table><tr><td><p>a1</p></td><td><p>b1</p></td></tr>" +
  "<tr><td><p>a2</p></td><td><p>b2</p></td></tr></table>";

function cellPos(editor: Editor, text: string) {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableCell" && node.textContent === text) {
      found = pos;
    }
  });
  if (found === null) throw new Error(`No cell shows "${text}"`);
  return found;
}

function cursorIn(editor: Editor, text: string) {
  act(() => {
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, cellPos(editor, text) + 2),
      ),
    );
  });
}

function selectCells(editor: Editor, from: string, to: string) {
  act(() => {
    editor.view.dispatch(
      editor.state.tr.setSelection(
        CellSelection.create(
          editor.state.doc,
          cellPos(editor, from),
          cellPos(editor, to),
        ),
      ),
    );
  });
}

/** The desktop table menu (the phone bar repeats it below `lg`). */
async function findMenu() {
  const [menu] = await screen.findAllByRole("toolbar", {
    name: m.editor_table_menu(),
  });
  return within(menu);
}

function menuItems(menu: HTMLElement) {
  return [...menu.querySelectorAll('[role^="menuitem"]')].map(
    (item) => item.textContent,
  );
}

function rowCount(editor: Editor) {
  return editor.state.doc.firstChild?.childCount;
}

it("groups the table actions under labelled row and column menus", async () => {
  const { editor } = await renderPostEditor({ content: TABLE });
  cursorIn(editor, "a1");

  const menu = await findMenu();
  menu.getByRole("button", { name: m.editor_table_delete_table() });
  expect(
    menu.queryByRole("button", { name: m.editor_table_merge_cells() }),
  ).toBeNull();
  expect(
    menu.queryByRole("button", { name: m.editor_table_split_cell() }),
  ).toBeNull();

  fireEvent.click(
    menu.getByRole("button", { name: m.editor_table_row_menu() }),
  );
  const rows = await findInPopover("menu", {
    name: m.editor_table_row_menu(),
  });
  expect(menuItems(rows)).toEqual([
    m.editor_table_add_row_before(),
    m.editor_table_add_row_after(),
    m.editor_table_toggle_header_row(),
    m.editor_table_delete_row(),
  ]);

  act(() => {
    fireEvent.click(
      within(rows).getByRole("menuitem", {
        name: m.editor_table_add_row_after(),
      }),
    );
  });
  expect(rowCount(editor)).toBe(3);
  await waitFor(() =>
    expect(
      screen.queryByRole("menu", { name: m.editor_table_row_menu() }),
    ).toBeNull(),
  );

  fireEvent.click(
    menu.getByRole("button", { name: m.editor_table_col_menu() }),
  );
  const columns = await findInPopover("menu", {
    name: m.editor_table_col_menu(),
  });
  expect(menuItems(columns)).toEqual([
    m.editor_table_add_col_before(),
    m.editor_table_add_col_after(),
    m.editor_table_toggle_header_col(),
    m.editor_table_delete_col(),
  ]);
});

it("offers merging on a multi-cell selection and splitting a merged cell", async () => {
  const { editor } = await renderPostEditor({ content: TABLE });
  selectCells(editor, "a1", "b1");

  const menu = await findMenu();
  const merge = await menu.findByRole("button", {
    name: m.editor_table_merge_cells(),
  });
  act(() => {
    fireEvent.click(merge);
  });
  expect(editor.state.doc.firstChild?.firstChild?.childCount).toBe(1);

  const split = await menu.findByRole("button", {
    name: m.editor_table_split_cell(),
  });
  expect(
    menu.queryByRole("button", { name: m.editor_table_merge_cells() }),
  ).toBeNull();
  act(() => {
    fireEvent.click(split);
  });
  expect(editor.state.doc.firstChild?.firstChild?.childCount).toBe(2);
});

it("aligns the selected column from the menu and shows its alignment", async () => {
  const { editor } = await renderPostEditor({ content: TABLE });
  cursorIn(editor, "b2");
  const menu = await findMenu();
  const buttons = menu
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);
  const center = () =>
    menu.getByRole("button", { name: m.editor_table_align_center() });
  const columnB = () =>
    [0, 1].map(
      (row) => editor.state.doc.firstChild?.child(row).child(1).attrs.align,
    );

  expect(buttons.indexOf(m.editor_table_align_left())).toBeGreaterThan(-1);
  expect(buttons.indexOf(m.editor_table_align_right())).toBe(
    buttons.indexOf(m.editor_table_align_left()) + 2,
  );
  expect(buttons.indexOf(m.editor_table_align_right())).toBeLessThan(
    buttons.indexOf(m.editor_table_delete_table()),
  );
  expect(center().getAttribute("aria-pressed")).toBe("false");

  act(() => {
    fireEvent.click(center());
  });
  expect(columnB()).toEqual(["center", "center"]);
  await waitFor(() =>
    expect(center().getAttribute("aria-pressed")).toBe("true"),
  );

  act(() => {
    fireEvent.click(center());
  });
  expect(columnB()).toEqual([null, null]);
  await waitFor(() =>
    expect(center().getAttribute("aria-pressed")).toBe("false"),
  );
});

it("shows whether the header row is on", async () => {
  const { editor } = await renderPostEditor({ content: TABLE });
  cursorIn(editor, "b2");
  const menu = await findMenu();

  fireEvent.click(
    menu.getByRole("button", { name: m.editor_table_row_menu() }),
  );
  const headerRow = () =>
    within(
      screen.getByRole("menu", { name: m.editor_table_row_menu() }),
    ).getByRole("menuitemcheckbox", {
      name: m.editor_table_toggle_header_row(),
    });
  await waitFor(() =>
    expect(headerRow().getAttribute("aria-checked")).toBe("false"),
  );

  act(() => {
    fireEvent.click(headerRow());
  });
  expect(editor.state.doc.firstChild?.firstChild?.firstChild?.type.name).toBe(
    "tableHeader",
  );
  fireEvent.click(
    menu.getByRole("button", { name: m.editor_table_row_menu() }),
  );
  await waitFor(() =>
    expect(headerRow().getAttribute("aria-checked")).toBe("true"),
  );
});
