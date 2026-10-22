// @vitest-environment jsdom
import type { Editor, JSONContent } from "@tiptap/core";
import { afterEach, expect, it } from "vitest";
import { createPostEditor, typeText } from "@/features/posts/editor/test-utils";
import { getMathEditor } from ".";

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

/** The document as nested node names, with text and LaTeX in quotes. */
function outline(target: Editor) {
  const describe = (node: JSONContent): string => {
    if (node.type === "text") return JSON.stringify(node.text);
    if (node.type === "inlineMath" || node.type === "blockMath") {
      return `${node.type}(${JSON.stringify(node.attrs?.latex)})`;
    }
    const children = (node.content ?? []).map(describe).join(" ");
    return children ? `${node.type}(${children})` : (node.type ?? "");
  };
  return (target.getJSON().content ?? []).map(describe);
}

it("turns $latex$ into inline math as the closing $ is typed", () => {
  const target = open("<p>energy</p>");
  typeText(target, " $E=mc^2$");

  expect(outline(target)).toEqual([
    'paragraph("energy " inlineMath("E=mc^2"))',
  ]);
  typeText(target, " holds");
  expect(outline(target)).toEqual([
    'paragraph("energy " inlineMath("E=mc^2") " holds")',
  ]);
});

it.each([
  ["prices", "$5 到 $10"],
  ["a space inside the closing $", "$x $"],
  ["an escaped dollar", "\\$x$"],
  ["Mathematics' old $$x$$ inline syntax", "a $$x$$"],
])("leaves %s as text", (_, typed) => {
  const target = open();
  typeText(target, typed);
  expect(outline(target)).toEqual([`paragraph(${JSON.stringify(typed)})`]);
});

it("turns an empty paragraph typed full with $$latex$$ into block math, continuing below", () => {
  const target = open("<p>a</p><p></p><p>b</p>", 4);
  typeText(target, "$$\\sum x_i$$");

  expect(outline(target)).toEqual([
    'paragraph("a")',
    'blockMath("\\\\sum x_i")',
    'paragraph("b")',
  ]);
  typeText(target, "c");
  expect(outline(target)).toEqual([
    'paragraph("a")',
    'blockMath("\\\\sum x_i")',
    'paragraph("cb")',
  ]);
});

it("adds a paragraph after block math typed on the last line", () => {
  const target = open("<p>a</p><p></p>", 4);
  typeText(target, "$$x$$");
  typeText(target, "c");

  expect(outline(target)).toEqual([
    'paragraph("a")',
    'blockMath("x")',
    'paragraph("c")',
  ]);
});

it("leaves Mathematics' old $$$x$$$ block syntax as text", () => {
  const target = open();
  typeText(target, "$$$x$$$");
  expect(outline(target)).toEqual(['paragraph("$$$x$$$")']);
});

const INLINE =
  '<p>a <span data-type="inline-math" data-latex="x^2"></span> b</p>';
const BLOCK =
  '<p>a</p><div data-type="block-math" data-latex="E=mc^2"></div><p>b</p>';

it("opens a formula for editing and applies new LaTeX", () => {
  const target = open(INLINE);

  expect(target.commands.openMathEditor(3)).toBe(true);
  expect(getMathEditor(target)).toMatchObject({
    pos: 3,
    type: "inline",
    latex: "x^2",
  });
  target.commands.applyMath(" y^3 ", "inline");

  expect(outline(target)).toEqual(['paragraph("a " inlineMath("y^3") " b")']);
  expect(getMathEditor(target)).toBeNull();
});

it("does not open on what is not a formula", () => {
  const target = open(INLINE);
  expect(target.commands.openMathEditor(1)).toBe(false);
  expect(getMathEditor(target)).toBeNull();
});

it("turns inline math into block math", () => {
  const target = open(INLINE);
  target.commands.openMathEditor(3);
  target.commands.applyMath("x^2", "block");

  expect(outline(target)).toEqual([
    'paragraph("a ")',
    'blockMath("x^2")',
    'paragraph(" b")',
  ]);
});

it("turns block math into inline math", () => {
  const target = open(BLOCK);
  target.commands.openMathEditor(3);
  expect(getMathEditor(target)?.type).toBe("block");
  target.commands.applyMath("E=mc^2", "inline");

  expect(outline(target)).toEqual([
    'paragraph("a")',
    'paragraph(inlineMath("E=mc^2"))',
    'paragraph("b")',
  ]);
});

it("removes the formula when applied empty", () => {
  const target = open(BLOCK);
  target.commands.openMathEditor(3);
  target.commands.applyMath("  ", "block");
  expect(outline(target)).toEqual(['paragraph("a")', 'paragraph("b")']);
});

it("leaves the formula as it was on cancel", () => {
  const target = open(INLINE);
  target.commands.openMathEditor(3);
  expect(target.commands.closeMathEditor()).toBe(true);

  expect(getMathEditor(target)).toBeNull();
  expect(outline(target)).toEqual(['paragraph("a " inlineMath("x^2") " b")']);
});

it("turns the selected text into inline math, open for editing", () => {
  const target = open("<p>so a^2+b^2 holds</p>");
  target.commands.setTextSelection({ from: 4, to: 11 });

  expect(target.commands.insertMath("inline")).toBe(true);
  expect(outline(target)).toEqual([
    'paragraph("so " inlineMath("a^2+b^2") " holds")',
  ]);
  expect(getMathEditor(target)).toMatchObject({
    pos: 4,
    type: "inline",
    latex: "a^2+b^2",
  });
});

it("gives the selected text back when its formula is cancelled", () => {
  const target = open("<p>so E=mc^2 holds</p>");
  target.commands.setTextSelection({ from: 4, to: 10 });
  target.commands.insertMath("inline");
  expect(outline(target)).toEqual([
    'paragraph("so " inlineMath("E=mc^2") " holds")',
  ]);

  expect(target.commands.closeMathEditor()).toBe(true);
  expect(outline(target)).toEqual(['paragraph("so E=mc^2 holds")']);
  expect(getMathEditor(target)).toBeNull();
});

it("inserts an empty formula for editing and drops it on cancel", () => {
  const target = open("<p>ab</p>", 2);
  target.commands.insertMath("inline");
  expect(getMathEditor(target)).toMatchObject({ pos: 2, latex: "" });

  target.commands.closeMathEditor();
  expect(outline(target)).toEqual(['paragraph("ab")']);
});

it("inserts block math in place of an empty line", () => {
  const target = open("<p>a</p><p></p><p>b</p>", 4);
  target.commands.insertMath("block");
  expect(getMathEditor(target)).toMatchObject({ pos: 3, type: "block" });

  target.commands.applyMath("x", "block");
  expect(outline(target)).toEqual([
    'paragraph("a")',
    'blockMath("x")',
    'paragraph("b")',
  ]);
});

it("follows the formula as the document changes and closes when it goes", () => {
  const target = open(INLINE);
  target.commands.openMathEditor(3);
  target.commands.insertContentAt(1, "zz");
  expect(getMathEditor(target)?.pos).toBe(5);

  target.commands.deleteRange({ from: 1, to: 8 });
  expect(getMathEditor(target)).toBeNull();
});

it("never opens in a read-only editor", () => {
  editor = createPostEditor({ content: INLINE, editable: false });
  expect(editor.commands.openMathEditor(3)).toBe(false);
  expect(editor.commands.insertMath("inline")).toBe(false);
  expect(getMathEditor(editor)).toBeNull();
});
