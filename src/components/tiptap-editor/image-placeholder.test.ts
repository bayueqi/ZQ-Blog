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
import {
  pressKey,
  renderPostEditor,
  typeText,
} from "@/features/posts/editor/test-utils";
import type { orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

const CAT = {
  id: 7,
  key: "2026/cat.png",
  url: "/images/2026/cat.png",
  fileName: "cat.png",
  mimeType: "image/png",
  sizeInBytes: 1024,
  width: 640,
  height: 480,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  postCount: 1,
  isCover: false,
};

const requests = vi.hoisted(() => ({
  importFromUrl: vi.fn<typeof orpcClient.media.importFromUrl>(),
}));
vi.mock("@/lib/orpc", async () => {
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    orpc: createTanstackQueryUtils({
      media: {
        list: async () => ({ items: [CAT], nextCursor: null }),
        stats: async () => ({}),
        linkedPosts: async () => [],
      },
    }),
    orpcClient: { media: { importFromUrl: requests.importFromUrl } },
  };
});

// Unmount popovers as soon as they close; exit motion is not under test.
vi.mock("@/hooks/use-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-motion")>()),
  useMotionPresence: (open: boolean) => open,
}));

afterEach(() => {
  cleanup();
  requests.importFromUrl.mockReset();
});

function picker() {
  return screen.queryByRole("dialog", { name: m.editor_image_picker_title() });
}

function topLevel(editor: Editor) {
  return (editor.getJSON().content ?? []).map((node: JSONContent) =>
    node.type === "image" ? `image[${String(node.attrs?.src)}]` : node.type,
  );
}

async function openFromToolbar() {
  const view = await renderPostEditor({ content: "<p>a</p><p></p>" });
  act(() => {
    view.editor.commands.setTextSelection(4);
  });
  act(() => {
    fireEvent.click(
      screen.getByRole("button", { name: m.editor_toolbar_image() }),
    );
  });
  const dialog = await findInPopover("dialog", {
    name: m.editor_image_picker_title(),
  });
  return { ...view, dialog };
}

it("inserts a placeholder from the toolbar and opens the picker beside it, not a modal", async () => {
  const { editor, dialog } = await openFromToolbar();

  expect(topLevel(editor)).toEqual([
    "paragraph",
    "imagePlaceholder",
    "paragraph",
  ]);
  expect(document.querySelector("dialog[open]")).toBeNull();
  expect(
    within(dialog)
      .getAllByRole("tab")
      .map((tab) => tab.textContent),
  ).toEqual([
    m.editor_image_tab_upload(),
    m.editor_image_tab_link(),
    m.editor_image_tab_library(),
  ]);
});

it("replaces the placeholder with an image picked from the media library", async () => {
  const { editor, dialog } = await openFromToolbar();

  act(() => {
    fireEvent.click(
      within(dialog).getByRole("tab", { name: m.editor_image_tab_library() }),
    );
  });
  const tile = await within(dialog).findByRole("button", { name: /cat\.png/ });
  act(() => {
    fireEvent.click(tile);
  });

  expect(topLevel(editor)).toEqual([
    "paragraph",
    "image[/images/2026/cat.png]",
    "paragraph",
  ]);
  expect(editor.getJSON().content?.[1]?.attrs).toMatchObject({
    width: 640,
    height: 480,
  });
  expect(picker()).toBeNull();
});

it("imports a linked image into the media library and puts it in place", async () => {
  requests.importFromUrl.mockResolvedValueOnce({
    ...CAT,
    url: "/images/2026/dog.png",
  });
  const { editor, dialog } = await openFromToolbar();

  act(() => {
    fireEvent.click(
      within(dialog).getByRole("tab", { name: m.editor_image_tab_link() }),
    );
  });
  const input = within(dialog).getByRole("textbox", {
    name: m.editor_image_url(),
  });
  act(() => {
    fireEvent.change(input, {
      target: { value: "https://example.com/dog.png" },
    });
    fireEvent.keyDown(input, { key: "Enter" });
  });

  await waitFor(() =>
    expect(topLevel(editor)).toEqual([
      "paragraph",
      "image[/images/2026/dog.png]",
      "paragraph",
    ]),
  );
  expect(requests.importFromUrl).toHaveBeenCalledWith({
    url: "https://example.com/dog.png",
  });
});

it("keeps the placeholder on Escape and reopens the picker when it is clicked", async () => {
  const { editor, dialog } = await openFromToolbar();

  act(() => {
    fireEvent.keyDown(dialog, { key: "Escape" });
  });
  expect(picker()).toBeNull();
  expect(topLevel(editor)).toEqual([
    "paragraph",
    "imagePlaceholder",
    "paragraph",
  ]);

  const placeholder = within(editor.view.dom).getByRole("button", {
    name: m.editor_image_placeholder(),
  });
  act(() => {
    fireEvent.click(placeholder);
  });
  expect(
    await findInPopover("dialog", { name: m.editor_image_picker_title() }),
  ).toBeDefined();
});

it("keeps the placeholder on a click elsewhere", async () => {
  const { editor } = await openFromToolbar();

  act(() => {
    fireEvent.mouseDown(document.body);
  });

  expect(picker()).toBeNull();
  expect(topLevel(editor)).toEqual([
    "paragraph",
    "imagePlaceholder",
    "paragraph",
  ]);
});

it("offers no placeholder interaction in a read-only editor", async () => {
  const { editor } = await renderPostEditor({
    content: '<div data-type="image-placeholder"></div><p></p>',
    editable: false,
  });
  expect(topLevel(editor)).toEqual(["imagePlaceholder", "paragraph"]);

  expect(
    within(editor.view.dom).queryByRole("button", {
      name: m.editor_image_placeholder(),
    }),
  ).toBeNull();
  act(() => {
    editor.commands.openImagePicker(0);
  });
  await act(async () => {});
  expect(picker()).toBeNull();
});

it("inserts a placeholder from the slash menu's image item", async () => {
  const { editor } = await renderPostEditor({ content: "<p>a</p><p></p>" });
  act(() => {
    editor.commands.setTextSelection(4);
  });

  act(() => typeText(editor, "/image"));
  await findInPopover("listbox", { name: m.editor_slash_menu() });
  act(() => {
    pressKey(editor, "Enter");
  });

  expect(
    await findInPopover("dialog", { name: m.editor_image_picker_title() }),
  ).toBeDefined();
  expect(topLevel(editor)).toEqual([
    "paragraph",
    "imagePlaceholder",
    "paragraph",
  ]);
  expect(editor.getText()).not.toContain("/image");
});
