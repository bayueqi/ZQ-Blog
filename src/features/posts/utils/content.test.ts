import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";
import { jsonContentHasType, replaceImageSrc } from "./content";

const doc = (...content: Array<JSONContent>): JSONContent => ({
  type: "doc",
  content,
});

describe("jsonContentHasType", () => {
  it("returns false for empty content", () => {
    expect(jsonContentHasType(null, "codeBlock")).toBe(false);
    expect(jsonContentHasType(doc(), "codeBlock")).toBe(false);
  });

  it("finds nested code and math nodes", () => {
    const content = doc(
      {
        type: "paragraph",
        content: [{ type: "inlineMath", attrs: { latex: "x" } }],
      },
      {
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [{ type: "text", text: "const n = 1;" }],
      },
    );

    expect(jsonContentHasType(content, "codeBlock")).toBe(true);
    expect(jsonContentHasType(content, ["inlineMath", "blockMath"])).toBe(true);
    expect(jsonContentHasType(content, "blockMath")).toBe(false);
    expect(jsonContentHasType(content, "image")).toBe(false);
  });
});

describe("replaceImageSrc", () => {
  const doc: JSONContent = {
    type: "doc",
    content: [
      { type: "image", attrs: { src: "/images/a.png", alt: "a" } },
      {
        type: "blockquote",
        content: [{ type: "image", attrs: { src: "/images/a.png?v=1" } }],
      },
      { type: "image", attrs: { src: "/images/b.png" } },
    ],
  };

  it("points every image of the key at the new src", () => {
    const next = replaceImageSrc(doc, "a.png", "/images/a.png?v=2");
    expect(next).toEqual({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "/images/a.png?v=2", alt: "a" } },
        {
          type: "blockquote",
          content: [{ type: "image", attrs: { src: "/images/a.png?v=2" } }],
        },
        { type: "image", attrs: { src: "/images/b.png" } },
      ],
    });
  });

  it("returns null when the document does not use the key", () => {
    expect(replaceImageSrc(doc, "c.png", "/images/c.png?v=2")).toBeNull();
  });
});
