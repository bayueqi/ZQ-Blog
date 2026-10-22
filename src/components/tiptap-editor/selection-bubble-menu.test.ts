// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { findInPopover } from "tests/popover";
import { afterEach, expect, it, vi } from "vitest";
import { renderPostEditor } from "@/features/posts/editor/test-utils";
import { m } from "@/paraglide/messages";

// Unmount popovers as soon as they close; exit motion is not under test.
vi.mock("@/hooks/use-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-motion")>()),
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

function select(editor: Editor, from: number, to: number) {
  act(() => {
    editor.chain().focus().setTextSelection({ from, to }).run();
  });
}

function findMenu() {
  // The menu follows the selection after a debounce; allow for a busy runner.
  return screen.findByRole(
    "toolbar",
    { name: m.editor_bubble_menu() },
    { timeout: 3000 },
  );
}

it("shows the formatting menu beside a text selection", async () => {
  const { editor } = await renderPostEditor({ content: "<p>see the docs</p>" });

  select(editor, 5, 13);

  const menu = await findMenu();
  for (const label of [
    m.editor_toolbar_bold(),
    m.editor_toolbar_italic(),
    m.editor_toolbar_underline(),
    m.editor_toolbar_strike(),
    m.editor_toolbar_code(),
    m.editor_bubble_menu_link(),
    m.editor_bubble_menu_inline_math(),
  ]) {
    expect(menu.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
  }
});

/** Waits past the menu's selection debounce. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
}

function menu() {
  return screen.queryByRole("toolbar", { name: m.editor_bubble_menu() });
}

it("stays hidden for a selection inside a code block", async () => {
  const { editor } = await renderPostEditor({
    content: "<pre><code>const a = 1;</code></pre>",
  });

  select(editor, 2, 8);
  await settle();

  expect(menu()).toBeNull();
});

it("stays hidden when an image is selected", async () => {
  const { editor } = await renderPostEditor({
    content: '<p>before</p><img src="https://example.com/a.png"><p>after</p>',
  });
  const imagePos = editor.state.doc.child(0).nodeSize;
  expect(editor.state.doc.nodeAt(imagePos)?.type.name).toBe("image");

  act(() => {
    editor.chain().focus().setNodeSelection(imagePos).run();
  });
  await settle();

  expect(menu()).toBeNull();
});

it("stays hidden in a read-only editor", async () => {
  const { editor } = await renderPostEditor({
    content: "<p>see the docs</p>",
    editable: false,
  });

  select(editor, 5, 13);
  await settle();

  expect(menu()).toBeNull();
});

function menuButton(label: string) {
  const found = menu()?.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!found) throw new Error(`No "${label}" button in the menu`);
  return found;
}

it("toggles a format on the selection and shows it as active", async () => {
  const { editor } = await renderPostEditor({ content: "<p>see the docs</p>" });
  select(editor, 5, 13);
  await findMenu();
  const bold = () => menuButton(m.editor_toolbar_bold());
  expect(bold().getAttribute("aria-pressed")).toBe("false");

  act(() => {
    fireEvent.click(bold());
  });

  expect(editor.getHTML()).toBe("<p>see <strong>the docs</strong></p>");
  await waitFor(() => expect(bold().getAttribute("aria-pressed")).toBe("true"));

  act(() => {
    fireEvent.click(bold());
  });
  expect(editor.getHTML()).toBe("<p>see the docs</p>");
});

it("opens the in-place link input from the link button", async () => {
  const { editor } = await renderPostEditor({ content: "<p>see the docs</p>" });
  select(editor, 5, 13);
  await findMenu();

  act(() => {
    // As in a browser, pressing the button focuses it before the click.
    const button = menuButton(m.editor_bubble_menu_link());
    fireEvent.mouseDown(button);
    button.focus();
    fireEvent.click(button);
  });

  const input = await findInPopover("textbox", {
    name: m.editor_link_url(),
  });
  expect(menu()).toBeNull();
  act(() => {
    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
  });
  const link = editor.view.dom.querySelector("a");
  expect(link?.textContent).toBe("the docs");
  expect(link?.getAttribute("href")).toBe("https://example.com");
});

it("turns the selected text into an inline formula, open for editing", async () => {
  const { editor } = await renderPostEditor({
    content: "<p>so E=mc^2 holds</p>",
  });
  select(editor, 4, 10);
  await findMenu();

  act(() => {
    fireEvent.click(menuButton(m.editor_bubble_menu_inline_math()));
  });

  const math = editor.state.doc.firstChild?.child(1);
  expect(math?.type.name).toBe("inlineMath");
  expect(math?.attrs.latex).toBe("E=mc^2");
  const input = await findInPopover("textbox", { name: "LaTeX" });
  expect((input as HTMLTextAreaElement).value).toBe("E=mc^2");
});
