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
import { pressKey, renderPostEditor } from "@/features/posts/editor/test-utils";
import { m } from "@/paraglide/messages";

// Unmount popovers as soon as they close; exit motion is not under test.
vi.mock("@/hooks/use-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-motion")>()),
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

function linkInput() {
  return screen.queryByRole("textbox", { name: m.editor_link_url() });
}

function linkedText(editor: Editor) {
  const nodes: JSONContent[] = editor.getJSON().content?.[0]?.content ?? [];
  return nodes
    .filter((node) => node.marks?.some((mark) => mark.type === "link"))
    .map((node) => [
      node.text,
      node.marks?.find((mark) => mark.type === "link")?.attrs?.href,
    ]);
}

it("opens the link input beside the selection on Ctrl+K and applies on Enter", async () => {
  const { editor } = await renderPostEditor({ content: "<p>see the docs</p>" });
  act(() => {
    editor.commands.setTextSelection({ from: 5, to: 13 });
  });

  act(() => {
    pressKey(editor, "k", { ctrlKey: true });
  });
  const input = await findInPopover("textbox", {
    name: m.editor_link_url(),
  });
  expect(document.activeElement).toBe(input);
  expect(document.querySelector("dialog[open]")).toBeNull();

  act(() => {
    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
  });

  expect(linkedText(editor)).toEqual([["the docs", "https://example.com"]]);
  expect(linkInput()).toBeNull();
});

it("cancels on Escape and returns focus to the editor", async () => {
  const { editor } = await renderPostEditor({ content: "<p>see the docs</p>" });
  act(() => {
    editor.commands.setTextSelection({ from: 5, to: 13 });
    pressKey(editor, "k", { ctrlKey: true });
  });
  const input = await findInPopover("textbox", {
    name: m.editor_link_url(),
  });

  act(() => {
    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.keyDown(input, { key: "Escape" });
  });

  expect(linkInput()).toBeNull();
  expect(linkedText(editor)).toEqual([]);
  await waitFor(() => expect(editor.isFocused).toBe(true));
});

it("opens the in-place input from the toolbar's link button, filled with the link's address", async () => {
  const { editor } = await renderPostEditor({
    content: '<p>see <a href="https://old.example">the docs</a></p>',
  });
  act(() => {
    editor.commands.setTextSelection(8);
  });

  act(() => {
    fireEvent.click(
      screen.getByRole("button", { name: m.editor_toolbar_link() }),
    );
  });

  const input = await findInPopover("textbox", {
    name: m.editor_link_url(),
  });
  expect((input as HTMLInputElement).value).toBe("https://old.example");
  expect(document.querySelector("dialog[open]")).toBeNull();
});

const LINKED = '<p>see <a href="https://old.example/docs">the docs</a></p>';

async function hoverLink(editor: Editor) {
  const link = editor.view.dom.querySelector("a");
  if (!link) throw new Error("No link in the editor");
  act(() => {
    fireEvent.mouseOver(link);
  });
  return findInPopover("group", { name: m.editor_link_card() });
}

it("shows the address on hovering a link, with a new-tab open link", async () => {
  const { editor } = await renderPostEditor({ content: LINKED });

  const card = await hoverLink(editor);

  expect(card.textContent).toContain("https://old.example/docs");
  const openLink = within(card).getByRole("link", {
    name: m.editor_link_open(),
  });
  expect(openLink.getAttribute("href")).toBe("https://old.example/docs");
  expect(openLink.getAttribute("target")).toBe("_blank");
});

it("edits the hovered link in place", async () => {
  const { editor } = await renderPostEditor({ content: LINKED });
  const card = await hoverLink(editor);

  act(() => {
    fireEvent.click(
      within(card).getByRole("button", { name: m.editor_link_edit() }),
    );
  });
  const input = await findInPopover("textbox", {
    name: m.editor_link_url(),
  });
  expect((input as HTMLInputElement).value).toBe("https://old.example/docs");
  expect(
    screen.queryByRole("group", { name: m.editor_link_card() }),
  ).toBeNull();

  act(() => {
    fireEvent.change(input, { target: { value: "new.example" } });
    fireEvent.keyDown(input, { key: "Enter" });
  });
  expect(linkedText(editor)).toEqual([["the docs", "https://new.example"]]);
});

it("removes the hovered link", async () => {
  const { editor } = await renderPostEditor({ content: LINKED });
  const card = await hoverLink(editor);

  act(() => {
    fireEvent.click(
      within(card).getByRole("button", { name: m.editor_link_remove() }),
    );
  });

  expect(linkedText(editor)).toEqual([]);
  expect(editor.getText()).toBe("see the docs");
  expect(
    screen.queryByRole("group", { name: m.editor_link_card() }),
  ).toBeNull();
});

it("shows neither the input nor the hover card in a read-only editor", async () => {
  const { editor } = await renderPostEditor({
    content: LINKED,
    editable: false,
  });
  const link = editor.view.dom.querySelector("a");
  if (!link) throw new Error("No link in the editor");

  act(() => {
    editor.commands.setTextSelection(8);
    pressKey(editor, "k", { ctrlKey: true });
    fireEvent.mouseOver(link);
  });
  // Longer than the hover card's opening delay.
  await act(() => new Promise((resolve) => setTimeout(resolve, 500)));

  expect(linkInput()).toBeNull();
  expect(
    screen.queryByRole("group", { name: m.editor_link_card() }),
  ).toBeNull();
});
