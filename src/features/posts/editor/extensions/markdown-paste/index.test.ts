// @vitest-environment jsdom
import type { JSONContent } from "@tiptap/core";
import { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { afterEach, expect, it, vi } from "vitest";
import { createSchemaExtensions } from "@/features/posts/editor/schema";
import { MarkdownPaste } from ".";

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

function createEditor(content: string, onLocalImages = vi.fn()) {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [
      ...createSchemaExtensions(),
      MarkdownPaste.configure({ onLocalImages }),
    ],
    content,
  });
  return editor;
}

function paste(target: Editor, data: Record<string, string>) {
  const event = {
    clipboardData: {
      getData: (type: string) => data[type] ?? "",
      types: Object.keys(data),
      files: [],
    },
  } as unknown as ClipboardEvent;
  return target.view.someProp("handlePaste", (handle) =>
    handle(target.view, event, Slice.empty),
  );
}

it("joins a single pasted paragraph into the paragraph at the cursor", () => {
  const target = createEditor("<p>ab</p>");
  target.commands.setTextSelection(2);

  expect(paste(target, { "text/plain": "**bold**" })).toBe(true);
  expect(target.getJSON().content).toEqual([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "a" },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: "b" },
      ],
    },
  ]);
});

it("formats Markdown copied from VS Code instead of making a code block", () => {
  const target = createEditor("<p></p>");

  paste(target, {
    "text/plain": "# Title\n\n- item",
    "vscode-editor-data": JSON.stringify({ mode: "markdown" }),
  });
  // The trailing paragraph comes from StarterKit's TrailingNode.
  expect(target.getJSON().content?.map((node) => node.type)).toEqual([
    "heading",
    "bulletList",
    "paragraph",
  ]);
});

it("reports images with a local path", () => {
  const onLocalImages = vi.fn();
  const target = createEditor("<p></p>", onLocalImages);

  paste(target, { "text/plain": "![a](./a.png)" });
  expect(onLocalImages).toHaveBeenCalledWith(1);
});

it("keeps the column alignment of a pasted table", () => {
  const target = createEditor("<p></p>");

  paste(target, {
    "text/plain": "| A | B | C | D |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |",
  });
  const table = target.getJSON().content?.find((node) => node.type === "table");
  const rows: Array<JSONContent> = table?.content ?? [];
  expect(
    rows.map((row) => row.content?.map((cell) => cell.attrs?.align)),
  ).toEqual([
    ["left", "center", "right", null],
    ["left", "center", "right", null],
  ]);
});

it("leaves pastes inside a code block to the default handler", () => {
  const target = createEditor("<pre><code>x</code></pre>");
  target.commands.setTextSelection(2);

  expect(paste(target, { "text/plain": "# not a heading" })).toBeFalsy();
});
