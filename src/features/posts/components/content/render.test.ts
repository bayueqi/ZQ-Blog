import type { JSONContent } from "@tiptap/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderReact } from "./render";

function cell(
  type: "tableHeader" | "tableCell",
  text: string,
  colwidth: Array<number> | null,
): JSONContent {
  return {
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth },
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function table(rows: Array<Array<JSONContent>>): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: rows.map((cells) => ({ type: "tableRow", content: cells })),
      },
    ],
  };
}

function render(content: JSONContent) {
  return renderToStaticMarkup(renderReact(content));
}

function colWidths(html: string) {
  return [...html.matchAll(/<col style="width:([^"]+)"/g)].map(
    (match) => match[1],
  );
}

describe("renderReact tables", () => {
  it("renders stored pixel widths as proportions of the full width", () => {
    const html = render(
      table([
        [cell("tableHeader", "A", [100]), cell("tableHeader", "B", [300])],
        [cell("tableCell", "1", [100]), cell("tableCell", "2", [300])],
      ]),
    );

    expect(html).toContain("fuwari-table-scroll");
    expect(html).toContain("table-layout:fixed");
    expect(colWidths(html)).toEqual(["25%", "75%"]);
    expect(html).not.toContain("100px");
    expect(html).not.toContain("300px");
  });

  it("gives a column without a stored width the average stored width", () => {
    const html = render(
      table([
        [
          cell("tableHeader", "A", [100]),
          cell("tableHeader", "B", null),
          cell("tableHeader", "C", [300]),
        ],
      ]),
    );

    expect(colWidths(html)).toEqual(["16.667%", "33.333%", "50%"]);
  });

  it("keeps the narrowest column at least 5rem wide, within two thirds of the layout", () => {
    const even = render(
      table([[cell("tableCell", "A", [100]), cell("tableCell", "B", [300])]]),
    );
    const skewed = render(
      table([[cell("tableCell", "A", [50]), cell("tableCell", "B", [950])]]),
    );

    // 5rem / 25% = 20rem; the table never needs more than two thirds of its
    // layout, so a table laid out in the wider editor fits the article.
    expect(even).toContain("min-width:min(20rem, 266.667px)");
    expect(skewed).toContain("min-width:min(100rem, 666.667px)");
  });

  it("reads one stored width per column a merged cell spans", () => {
    const html = render(
      table([
        [
          {
            ...cell("tableHeader", "AB", [100, 200]),
            attrs: { colspan: 2, rowspan: 1, colwidth: [100, 200] },
          },
          cell("tableHeader", "C", [300]),
        ],
        [
          cell("tableCell", "1", [100]),
          cell("tableCell", "2", [200]),
          cell("tableCell", "3", [300]),
        ],
      ]),
    );

    expect(colWidths(html)).toEqual(["16.667%", "33.333%", "50%"]);
  });

  it("renders a table without stored widths as before", () => {
    const html = render(
      table([
        [
          cell("tableHeader", "A", null),
          cell("tableHeader", "B", null),
          cell("tableHeader", "C", null),
        ],
      ]),
    );

    expect(html).toContain("fuwari-table-scroll");
    expect(html).toContain("<thead");
    expect(html.match(/<th\b/g)?.length).toBe(3);
    expect(html).not.toContain("<colgroup");
    expect(html).not.toContain("style=");
  });

  it("aligns header and body cells by their stored alignment", () => {
    const aligned = (
      type: "tableHeader" | "tableCell",
      text: string,
      align: string | null,
    ): JSONContent => {
      const base = cell(type, text, null);
      return { ...base, attrs: { ...base.attrs, align } };
    };
    const html = render(
      table([
        [
          aligned("tableHeader", "A", "center"),
          aligned("tableHeader", "B", "right"),
          aligned("tableHeader", "C", null),
        ],
        [
          aligned("tableCell", "1", "center"),
          aligned("tableCell", "2", "right"),
          aligned("tableCell", "3", "left"),
        ],
      ]),
    );

    const shown = [...html.matchAll(/<(th|td)\b([^>]*)>/g)].map(
      ([, tag, attrs]) =>
        `${tag} ${/style="text-align:(\w+)"/.exec(attrs)?.[1] ?? "-"}`,
    );
    expect(shown).toEqual([
      "th center",
      "th right",
      "th -",
      "td center",
      "td right",
      "td left",
    ]);
  });

  it("renders inline and block math from the public schema", async () => {
    const { renderReactWithMath } = await import("./render-math");
    const html = renderToStaticMarkup(
      renderReactWithMath({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "inlineMath", attrs: { latex: "x^2" } }],
          },
          { type: "blockMath", attrs: { latex: "E=mc^2" } },
        ],
      }),
    );

    expect(html).toContain('data-type="inline-math"');
    expect(html).toContain('data-type="block-math"');
    expect(html).toContain("katex");
  });

  it("does not require KaTeX to print math node latex", () => {
    const html = renderToStaticMarkup(
      renderReact({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "inlineMath", attrs: { latex: "x^2" } }],
          },
        ],
      }),
    );

    expect(html).toContain('data-type="inline-math"');
    expect(html).toContain("x^2");
    expect(html).not.toContain("katex");
  });
});
