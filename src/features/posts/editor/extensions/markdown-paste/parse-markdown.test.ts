// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getPastedMarkdown, parsePastedMarkdown } from "./parse-markdown";

function text(value: string) {
  return { type: "text", text: value };
}

function clipboard(data: Record<string, string>, files: Array<File> = []) {
  return {
    getData: (type: string) => data[type] ?? "",
    types: Object.keys(data),
    files: files as unknown as FileList,
  };
}

describe("parsePastedMarkdown", () => {
  it("maps the highest heading to H2 and caps the rest at H4", () => {
    const { content } = parsePastedMarkdown("# One\n## Two\n###### Six");
    expect(content.map((node) => node.attrs?.level)).toEqual([2, 3, 4]);
  });

  it("raises headings that start below H2", () => {
    const { content } = parsePastedMarkdown("### Three\n#### Four");
    expect(content.map((node) => node.attrs?.level)).toEqual([2, 3]);
  });

  it("drops front matter", () => {
    const { content } = parsePastedMarkdown("---\ntitle: Post\n---\nBody");
    expect(content).toEqual([{ type: "paragraph", content: [text("Body")] }]);
  });

  it("keeps task markers as text in a plain list", () => {
    const { content } = parsePastedMarkdown("- [ ] todo **now**\n- [x] done");
    expect(content).toEqual([
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  text("[ ] todo "),
                  { ...text("now"), marks: [{ type: "bold" }] },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [text("[x] done")] }],
          },
        ],
      },
    ]);
  });

  it("keeps footnote definitions as text but still resolves link references", () => {
    const { content } = parsePastedMarkdown(
      "Note[^1] and [site][r]\n\n[^1]: The note\n\n[r]: https://example.com",
    );
    expect(content).toEqual([
      {
        type: "paragraph",
        content: [
          text("Note[^1] and "),
          {
            ...text("site"),
            marks: [
              {
                type: "link",
                attrs: { href: "https://example.com", title: null },
              },
            ],
          },
        ],
      },
      { type: "paragraph", content: [text("[^1]: The note")] },
    ]);
  });

  it("leaves dollar amounts as text and parses math", () => {
    const { content } = parsePastedMarkdown(
      "From $5 to $10, $x^2$ and $$y$$\n\n$$\na+b\n$$",
    );
    expect(content).toEqual([
      {
        type: "paragraph",
        content: [
          text("From $5 to $10, "),
          { type: "inlineMath", attrs: { latex: "x^2" } },
          text(" and $$y$$"),
        ],
      },
      { type: "blockMath", attrs: { latex: "a+b" } },
    ]);
  });

  it("lifts remote images out of paragraphs and keeps local paths as text", () => {
    const result = parsePastedMarkdown(
      "Before ![r](https://example.com/a.png) after ![l](./b.png)\n\n![c](img/c.png)",
    );
    expect(result.localImageCount).toBe(2);
    expect(result.content).toEqual([
      { type: "paragraph", content: [text("Before ")] },
      {
        type: "image",
        attrs: { src: "https://example.com/a.png", alt: "r", title: null },
      },
      {
        type: "paragraph",
        content: [text(" after "), text("![l](./b.png)")],
      },
      { type: "paragraph", content: [text("![c](img/c.png)")] },
    ]);
  });

  it("turns a mermaid fence into a mermaid code block", () => {
    const { content } = parsePastedMarkdown(
      "```mermaid\nflowchart LR\n  A --> B\n```",
    );
    expect(content).toEqual([
      {
        type: "codeBlock",
        attrs: { language: "mermaid" },
        content: [text("flowchart LR\n  A --> B")],
      },
    ]);
  });

  it("keeps the text of HTML tags the editor does not know", () => {
    const { content } = parsePastedMarkdown("H<sub>2</sub>O");
    expect(content).toEqual([{ type: "paragraph", content: [text("H2O")] }]);
  });
});

describe("getPastedMarkdown", () => {
  const outsideCode = { inCode: false, plainText: false };

  it("returns plain text", () => {
    expect(
      getPastedMarkdown(clipboard({ "text/plain": "# Hi" }), outsideCode),
    ).toBe("# Hi");
  });

  it("leaves HTML to the default paste", () => {
    expect(
      getPastedMarkdown(
        clipboard({ "text/plain": "# Hi", "text/html": "<h1>Hi</h1>" }),
        outsideCode,
      ),
    ).toBeNull();
  });

  it("takes Markdown and plain text from VS Code", () => {
    for (const mode of ["markdown", "plaintext"]) {
      expect(
        getPastedMarkdown(
          clipboard({
            "text/plain": "# Hi",
            "text/html": "<div>",
            "vscode-editor-data": JSON.stringify({ mode }),
          }),
          outsideCode,
        ),
      ).toBe("# Hi");
    }
  });

  it("leaves other VS Code languages to the code block", () => {
    expect(
      getPastedMarkdown(
        clipboard({
          "text/plain": "const a = 1;",
          "vscode-editor-data": JSON.stringify({ mode: "typescript" }),
        }),
        outsideCode,
      ),
    ).toBeNull();
  });

  it("skips code blocks, Ctrl+Shift+V and files", () => {
    const data = clipboard({ "text/plain": "# Hi" });
    expect(
      getPastedMarkdown(data, { inCode: true, plainText: false }),
    ).toBeNull();
    expect(
      getPastedMarkdown(data, { inCode: false, plainText: true }),
    ).toBeNull();
    expect(
      getPastedMarkdown(
        clipboard({ "text/plain": "# Hi" }, [new File([""], "a.png")]),
        outsideCode,
      ),
    ).toBeNull();
  });
});
