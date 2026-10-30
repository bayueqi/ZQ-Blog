// @vitest-environment jsdom
import type { Editor, JSONContent } from "@tiptap/core";
import { afterEach, expect, it } from "vitest";
import {
  createPostEditor,
  pressKey,
  typeText,
} from "@/features/posts/editor/test-utils";
import { getMathEditor } from "@/features/posts/editor/extensions/math-editing";
import { getSlashMenu } from ".";

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

/** An editor with the cursor at `pos`, or at the end of the document. */
function open(content = "<p></p>", pos?: number) {
  editor = createPostEditor({ content });
  if (pos === undefined) editor.commands.focus("end");
  else editor.commands.setTextSelection(pos);
  return editor;
}

function shownItems(target: Editor) {
  return getSlashMenu(target)?.items.map((item) => item.id);
}

/** The document as nested node names, with text in quotes. */
function outline(target: Editor) {
  const describe = (node: JSONContent): string => {
    if (node.type === "text") return JSON.stringify(node.text);
    const level = node.type === "heading" ? String(node.attrs?.level) : "";
    const children = (node.content ?? []).map(describe).join(" ");
    return children
      ? `${node.type}${level}(${children})`
      : `${node.type}${level}`;
  };
  return (target.getJSON().content ?? []).map(describe);
}

it.each(["标题", "heading", "Heading"])("filters the items by %s", (query) => {
  const target = open();
  typeText(target, `/${query}`);
  expect(shownItems(target)).toEqual(["heading2", "heading3", "heading4"]);
});

it("matches Chinese names and English keywords for other items too", () => {
  const target = open();
  typeText(target, "/代码");
  expect(shownItems(target)).toEqual(["codeBlock"]);

  target.commands.setContent("<p></p>");
  typeText(target, "/image");
  expect(shownItems(target)).toEqual(["image"]);
});

it("opens at the start of a line and after whitespace only", () => {
  const target = open();
  typeText(target, "/");
  expect(getSlashMenu(target)).not.toBeNull();

  target.commands.setContent("<p></p>");
  typeText(target, "a /");
  expect(getSlashMenu(target)).not.toBeNull();

  target.commands.setContent("<p></p>");
  typeText(target, "a/");
  expect(getSlashMenu(target)).toBeNull();
});

it("does not open in a code block", () => {
  const target = open("<pre><code>const a = 1</code></pre>", 1);
  typeText(target, "/");
  expect(getSlashMenu(target)).toBeNull();
  expect(outline(target)[0]).toBe('codeBlock("/const a = 1")');
});

it("does not open in a read-only editor", () => {
  editor = createPostEditor({ editable: false });
  editor.commands.insertContent("/");
  expect(getSlashMenu(editor)).toBeNull();
});

it.each([
  ["h2", "<p>Title</p>", ['heading2("Title")', "paragraph"]],
  ["h3", "<p>Title</p>", ['heading3("Title")', "paragraph"]],
  ["h4", "<p>Title</p>", ['heading4("Title")', "paragraph"]],
  ["正文", "<h3>Title</h3>", ['paragraph("Title")', "paragraph"]],
  [
    "bullet",
    "<p>Title</p>",
    ['bulletList(listItem(paragraph("Title")))', "paragraph"],
  ],
  [
    "有序",
    "<p>Title</p>",
    ['orderedList(listItem(paragraph("Title")))', "paragraph"],
  ],
  ["quote", "<p>Title</p>", ['blockquote(paragraph("Title"))', "paragraph"]],
  ["code", "<p>Title</p>", ['codeBlock("Title")', "paragraph"]],
  [
    "分隔",
    "<p>a</p><p></p><p>b</p>",
    ['paragraph("a")', "horizontalRule", 'paragraph("b")'],
  ],
] as const)(
  "/%s replaces the typed text with its block",
  (query, content, expected) => {
    // Position 1 is the start of the first block; 4 the empty middle one.
    const target = open(content, content.startsWith("<p>a") ? 4 : 1);
    typeText(target, `/${query}`);
    expect(pressKey(target, "Enter")).toBe(true);
    expect(outline(target)).toEqual(expected);
    expect(getSlashMenu(target)).toBeNull();
  },
);

it("inserts a 3×3 table with a header row in place of an empty line", () => {
  const target = open("<p>a</p><p></p><p>b</p>", 4);
  typeText(target, "/表格");
  pressKey(target, "Enter");

  const header =
    "tableRow(tableHeader(paragraph) tableHeader(paragraph) tableHeader(paragraph))";
  const row =
    "tableRow(tableCell(paragraph) tableCell(paragraph) tableCell(paragraph))";
  expect(outline(target)).toEqual([
    'paragraph("a")',
    `table(${header} ${row} ${row})`,
    'paragraph("b")',
  ]);
});

it("/公式 puts block math in place of the line, open for editing", () => {
  const target = open("<p>a</p><p></p><p>b</p>", 4);
  typeText(target, "/公式");
  pressKey(target, "Enter");

  expect(outline(target)).toEqual([
    'paragraph("a")',
    "blockMath",
    'paragraph("b")',
  ]);
  expect(getMathEditor(target)).toMatchObject({ pos: 3, type: "block" });
});

it("inserts an image placeholder in place of the typed /图片", () => {
  const target = open("<p>a</p><p></p>", 4);
  typeText(target, "/图片");
  pressKey(target, "Enter");

  expect(outline(target)).toEqual([
    'paragraph("a")',
    "imagePlaceholder",
    "paragraph",
  ]);
});

it("moves the active item with the arrow keys, wrapping around", () => {
  const target = open("<p>Title</p>", 1);
  typeText(target, "/标题");
  expect(getSlashMenu(target)?.activeIndex).toBe(0);

  pressKey(target, "ArrowDown");
  pressKey(target, "ArrowDown");
  expect(getSlashMenu(target)?.activeIndex).toBe(2);
  pressKey(target, "ArrowDown");
  expect(getSlashMenu(target)?.activeIndex).toBe(0);
  pressKey(target, "ArrowUp");
  pressKey(target, "Enter");

  expect(outline(target)).toEqual(['heading4("Title")', "paragraph"]);
});

it("closes on Escape and leaves the typed text", () => {
  const target = open();
  typeText(target, "/h2");
  expect(pressKey(target, "Escape")).toBe(true);

  expect(getSlashMenu(target)).toBeNull();
  pressKey(target, "Enter");
  expect(outline(target)).toEqual(['paragraph("/h2")', "paragraph"]);
});

it("lets Enter split the line when nothing matches", () => {
  const target = open();
  typeText(target, "/zzz");
  expect(shownItems(target)).toEqual([]);

  pressKey(target, "Enter");
  expect(outline(target)).toEqual(['paragraph("/zzz")', "paragraph"]);
});

it.each(["mermaid", "图表", "flowchart"])(
  "/%s replaces the typed text with an empty Mermaid code block",
  (query) => {
    const target = open("<p>a</p><p></p>", 4);
    typeText(target, `/${query}`);
    expect(shownItems(target)?.[0]).toBe("mermaid");
    pressKey(target, "Enter");

    const [first, block] = target.getJSON().content ?? [];
    expect(outline(target)[0]).toBe('paragraph("a")');
    expect(block?.type).toBe("codeBlock");
    expect(block?.attrs?.language).toBe("mermaid");
    expect(block?.content).toBeUndefined();
    expect(first?.type).toBe("paragraph");
  },
);

it("lists the Mermaid item right after the code block item", () => {
  const target = open();
  typeText(target, "/");
  const ids = shownItems(target) ?? [];
  expect(ids[ids.indexOf("codeBlock") + 1]).toBe("mermaid");
});
