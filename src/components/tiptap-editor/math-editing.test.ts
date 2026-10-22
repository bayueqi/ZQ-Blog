// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Editor, JSONContent } from "@tiptap/core";
import { findInPopover } from "tests/popover";
import { afterEach, expect, it, vi } from "vitest";
import { renderPostEditor, typeText } from "@/features/posts/editor/test-utils";
import { m } from "@/paraglide/messages";

// Unmount popovers as soon as they close; exit motion is not under test.
vi.mock("@/hooks/use-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-motion")>()),
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

const INLINE =
  '<p>a <span data-type="inline-math" data-latex="x^2"></span> b</p>';
const BLOCK =
  '<p>a</p><div data-type="block-math" data-latex="E=mc^2"></div><p>b</p>';

function latexInput() {
  return screen.queryByRole("textbox", { name: "LaTeX" });
}

/** Every formula in the document, as type and LaTeX. */
function formulas(editor: Editor) {
  const found: Array<[string | undefined, unknown]> = [];
  const walk = (node: JSONContent) => {
    if (node.type === "inlineMath" || node.type === "blockMath") {
      found.push([node.type, node.attrs?.latex]);
    }
    node.content?.forEach(walk);
  };
  walk(editor.getJSON());
  return found;
}

function clickFormula(editor: Editor, type: "inline-math" | "block-math") {
  const formula = editor.view.dom.querySelector(`[data-type="${type}"]`);
  if (!formula) throw new Error(`No ${type} in the editor`);
  act(() => {
    fireEvent.click(formula.querySelector(".katex") ?? formula);
  });
}

it("edits a clicked inline formula in a popover, applying on Ctrl+Enter", async () => {
  const { editor } = await renderPostEditor({ content: INLINE });

  clickFormula(editor, "inline-math");
  const panel = await findInPopover("dialog", {
    name: m.editor_formula_edit(),
  });
  const input = within(panel).getByRole("textbox", { name: "LaTeX" });
  expect((input as HTMLTextAreaElement).value).toBe("x^2");
  expect(document.activeElement).toBe(input);
  expect(document.querySelector("dialog[open]")).toBeNull();

  act(() => {
    fireEvent.change(input, { target: { value: "\\frac{1}{2}" } });
  });
  const preview = within(panel).getByRole("status", {
    name: m.editor_formula_preview(),
  });
  expect(preview.querySelector(".katex")).not.toBeNull();

  act(() => {
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
  });
  expect(formulas(editor)).toEqual([["inlineMath", "\\frac{1}{2}"]]);
  expect(latexInput()).toBeNull();
});

it("shows LaTeX errors in the preview", async () => {
  const { editor } = await renderPostEditor({ content: INLINE });
  clickFormula(editor, "inline-math");
  const input = await findInPopover("textbox", { name: "LaTeX" });

  act(() => {
    fireEvent.change(input, { target: { value: "\\frac{1}{" } });
  });

  const preview = screen.getByRole("status", {
    name: m.editor_formula_preview(),
  });
  expect(preview.textContent).toMatch(/KaTeX parse error/);
});

it("switches a formula from inline to block", async () => {
  const { editor } = await renderPostEditor({ content: INLINE });
  clickFormula(editor, "inline-math");
  const panel = await findInPopover("dialog", {
    name: m.editor_formula_edit(),
  });

  act(() => {
    fireEvent.click(
      within(panel).getByRole("radio", { name: m.editor_formula_block() }),
    );
  });
  act(() => {
    fireEvent.click(
      within(panel).getByRole("button", { name: m.editor_formula_apply() }),
    );
  });

  expect(formulas(editor)).toEqual([["blockMath", "x^2"]]);
});

it("cancels on Escape and returns focus to the editor", async () => {
  const { editor } = await renderPostEditor({ content: INLINE });
  clickFormula(editor, "inline-math");
  const input = await findInPopover("textbox", { name: "LaTeX" });

  act(() => {
    fireEvent.change(input, { target: { value: "y" } });
    fireEvent.keyDown(input, { key: "Escape" });
  });

  expect(latexInput()).toBeNull();
  expect(formulas(editor)).toEqual([["inlineMath", "x^2"]]);
  await waitFor(() => expect(editor.isFocused).toBe(true));
});

it("expands a clicked block formula in place, applying on Cmd+Enter", async () => {
  const { editor } = await renderPostEditor({ content: BLOCK });

  clickFormula(editor, "block-math");
  const block = editor.view.dom.querySelector('[data-type="block-math"]');
  if (!(block instanceof HTMLElement)) throw new Error("No block math");
  const input = await within(block).findByRole("textbox", { name: "LaTeX" });
  expect((input as HTMLTextAreaElement).value).toBe("E=mc^2");
  await waitFor(() => expect(document.activeElement).toBe(input));

  act(() => {
    fireEvent.change(input, { target: { value: "E=mc^3" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
  });

  expect(formulas(editor)).toEqual([["blockMath", "E=mc^3"]]);
  expect(latexInput()).toBeNull();
});

it("closes the block editor on a click elsewhere, keeping the formula", async () => {
  const { editor } = await renderPostEditor({ content: BLOCK });
  clickFormula(editor, "block-math");
  const input = await screen.findByRole("textbox", { name: "LaTeX" });

  act(() => {
    fireEvent.change(input, { target: { value: "z" } });
    fireEvent.mouseDown(document.body);
  });

  expect(latexInput()).toBeNull();
  expect(formulas(editor)).toEqual([["blockMath", "E=mc^2"]]);
});

it.each([
  [m.editor_toolbar_formula_inline(), "inlineMath"],
  [m.editor_toolbar_formula_block(), "blockMath"],
])(
  "inserts a formula from the toolbar's %s button and opens it in place",
  async (button, type) => {
    const { editor } = await renderPostEditor({ content: "<p>a</p>" });
    act(() => {
      editor.commands.setTextSelection(2);
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: button }));
    });
    const input = await screen.findByRole("textbox", { name: "LaTeX" });
    expect(document.querySelector("dialog[open]")).toBeNull();

    act(() => {
      fireEvent.change(input, { target: { value: "x" } });
      fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    });
    expect(formulas(editor)).toEqual([[type, "x"]]);
  },
);

it("opens block math from the slash menu in place", async () => {
  const { editor } = await renderPostEditor();
  editor.commands.focus("end");

  act(() => typeText(editor, "/公式"));
  await findInPopover("listbox", { name: m.editor_slash_menu() });
  act(() => {
    fireEvent.keyDown(editor.view.dom, { key: "Enter" });
  });

  const input = await screen.findByRole("textbox", { name: "LaTeX" });
  expect(input.closest('[data-type="block-math"]')).not.toBeNull();
  expect(editor.view.dom.contains(input)).toBe(true);
});

it("does not open formula editing in a read-only editor", async () => {
  const { editor } = await renderPostEditor({
    content: INLINE + BLOCK,
    editable: false,
  });

  clickFormula(editor, "inline-math");
  clickFormula(editor, "block-math");
  await act(async () => {});

  expect(latexInput()).toBeNull();
});
