// @vitest-environment jsdom
import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { afterEach, expect, it } from "vitest";
import {
  createPostEditor,
  pressKey,
  typeText,
} from "@/features/posts/editor/test-utils";
import { getLinkEditor } from ".";

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

function open(content: string) {
  editor = createPostEditor({ content });
  return editor;
}

/** The paragraph's text runs, with the link each one carries. */
function runs(target: Editor) {
  const nodes: JSONContent[] = target.getJSON().content?.[0]?.content ?? [];
  return nodes.map((node) => ({
    text: node.text,
    href: node.marks?.find((mark) => mark.type === "link")?.attrs?.href,
  }));
}

it("links the selected text with the normalised URL", () => {
  const target = open("<p>see the docs here</p>");
  target.commands.setTextSelection({ from: 5, to: 13 });

  expect(target.commands.openLinkEditor()).toBe(true);
  expect(getLinkEditor(target)?.href).toBe("");
  target.commands.applyLink("example.com/docs");

  expect(runs(target)).toEqual([
    { text: "see ", href: undefined },
    { text: "the docs", href: "https://example.com/docs" },
    { text: " here", href: undefined },
  ]);
  expect(getLinkEditor(target)).toBeNull();
});

it("edits the whole link the cursor is in", () => {
  const target = open('<p>see <a href="https://old.example">the docs</a></p>');
  target.commands.setTextSelection(8);

  target.commands.openLinkEditor();
  expect(getLinkEditor(target)?.href).toBe("https://old.example");
  target.commands.applyLink("https://new.example");

  expect(runs(target)).toEqual([
    { text: "see ", href: undefined },
    { text: "the docs", href: "https://new.example" },
  ]);
});

it("removes the link when applied empty", () => {
  const target = open('<p>see <a href="https://old.example">the docs</a></p>');
  target.commands.setTextSelection(8);

  target.commands.openLinkEditor();
  target.commands.applyLink("   ");

  expect(runs(target)).toEqual([{ text: "see the docs", href: undefined }]);
});

it("inserts the URL as linked text at a bare cursor, opened with Mod-k", () => {
  const target = open("<p>see</p>");
  target.commands.focus("end");

  expect(pressKey(target, "k", { ctrlKey: true })).toBe(true);
  expect(getLinkEditor(target)).not.toBeNull();
  target.commands.applyLink("example.com");

  expect(runs(target)).toEqual([
    { text: "see", href: undefined },
    { text: "example.com", href: "https://example.com" },
  ]);
  // Typing on continues as plain text.
  typeText(target, "!");
  expect(runs(target).at(-1)).toEqual({ text: "!", href: undefined });
});

it("does nothing at a bare cursor when applied empty", () => {
  const target = open("<p>see</p>");
  target.commands.focus("end");

  target.commands.openLinkEditor();
  target.commands.applyLink("");

  expect(runs(target)).toEqual([{ text: "see", href: undefined }]);
  expect(getLinkEditor(target)).toBeNull();
});

it("still links the selected text when a URL is pasted over it", () => {
  const target = open("<p>see the docs</p>");
  target.commands.setTextSelection({ from: 5, to: 13 });

  const url = "https://example.com/docs";
  const event = {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? url : ""),
      types: ["text/plain"],
      files: [],
    },
  } as unknown as ClipboardEvent;
  const slice = new Slice(Fragment.from(target.schema.text(url)), 0, 0);
  target.view.someProp("handlePaste", (handle) =>
    handle(target.view, event, slice),
  );

  expect(runs(target)).toEqual([
    { text: "see ", href: undefined },
    { text: "the docs", href: url },
  ]);
});

it("follows the text it links as the document changes and closes when it goes", () => {
  const target = open("<p>see the docs</p>");
  target.commands.setTextSelection({ from: 5, to: 13 });
  target.commands.openLinkEditor();

  target.commands.insertContentAt(1, "go ");
  expect(getLinkEditor(target)).toMatchObject({ from: 8, to: 16 });
  target.commands.applyLink("example.com");
  expect(runs(target)).toEqual([
    { text: "go see ", href: undefined },
    { text: "the docs", href: "https://example.com" },
  ]);

  target.commands.setTextSelection({ from: 8, to: 16 });
  target.commands.openLinkEditor();
  target.commands.deleteRange({ from: 6, to: 17 });
  expect(getLinkEditor(target)).toBeNull();
});

it("does not open in a read-only editor", () => {
  editor = createPostEditor({
    content: "<p>see the docs</p>",
    editable: false,
  });
  editor.commands.setTextSelection({ from: 1, to: 4 });

  expect(editor.commands.openLinkEditor()).toBe(false);
  expect(pressKey(editor, "k", { ctrlKey: true })).toBe(false);
  expect(getLinkEditor(editor)).toBeNull();
});
