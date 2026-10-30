// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
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

function slashMenu() {
  return screen.queryByRole("listbox", { name: m.editor_slash_menu() });
}

it("opens the slash menu on / and closes it on Escape", async () => {
  const { editor } = await renderPostEditor();
  editor.commands.focus("end");

  act(() => typeText(editor, "/"));
  const menu = await findInPopover("listbox", {
    name: m.editor_slash_menu(),
  });
  const options = within(menu).getAllByRole("option");
  expect(options[0]?.textContent).toBe(m.editor_slash_paragraph());
  expect(options[0]?.getAttribute("aria-selected")).toBe("true");

  act(() => typeText(editor, "标题"));
  expect(
    within(menu)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual([
    m.editor_slash_heading2(),
    m.editor_slash_heading3(),
    m.editor_slash_heading4(),
  ]);

  act(() => {
    pressKey(editor, "Escape");
  });
  expect(slashMenu()).toBeNull();
});

it("inserts the clicked item", async () => {
  const { editor } = await renderPostEditor();
  editor.commands.focus("end");

  act(() => typeText(editor, "/quote"));
  const menu = await findInPopover("listbox", {
    name: m.editor_slash_menu(),
  });
  act(() => {
    fireEvent.click(
      within(menu).getByRole("option", { name: m.editor_slash_blockquote() }),
    );
  });

  expect(editor.getJSON().content?.[0]?.type).toBe("blockquote");
  expect(slashMenu()).toBeNull();
});

it("does not show the slash menu in a read-only editor", async () => {
  const { editor } = await renderPostEditor({ editable: false });

  act(() => typeText(editor, "/"));
  await act(async () => {});
  expect(slashMenu()).toBeNull();
});
