// @vitest-environment jsdom
import type { Editor } from "@tiptap/core";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import type { JSONContent } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";
import { createPostEditor } from "@/features/posts/editor/test-utils";

function cell(text: string, colwidth: Array<number> | null): JSONContent {
  return {
    type: "tableCell",
    attrs: { colspan: 1, rowspan: 1, colwidth },
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function doc(widths: Array<number | null>): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: widths.map((width, index) =>
              cell(`${index}`, width === null ? null : [width]),
            ),
          },
        ],
      },
    ],
  };
}

function shownTable(editor: Editor) {
  const table = editor.view.dom.querySelector("table");
  if (!table) throw new Error("The editor shows no table");
  return {
    table,
    widths: [...table.querySelectorAll("colgroup > col")].map(
      (col) => (col as HTMLElement).style.width,
    ),
  };
}

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("post editor tables", () => {
  it("shows stored widths as the proportions the public page uses", () => {
    editor = createPostEditor({ content: doc([100, null, 300]) });

    const { table, widths } = shownTable(editor);
    expect(widths).toEqual(["16.667%", "33.333%", "50%"]);
    expect(table.hasAttribute("data-column-widths")).toBe(true);
    expect(table.style.minWidth).toBe("min(30rem, 400px)");
  });

  it("lets the Admin drag column widths while editing", () => {
    editor = createPostEditor({ content: doc([100, 300]) });

    expect(columnResizingPluginKey.getState(editor.state)).toBeDefined();
  });

  it("shows the same widths in a read-only view, without resize handles", () => {
    editor = createPostEditor({ content: doc([100, 300]), editable: false });

    expect(shownTable(editor).widths).toEqual(["25%", "75%"]);
    expect(columnResizingPluginKey.getState(editor.state)).toBeUndefined();
  });

  it("leaves a table without stored widths to size by content", () => {
    editor = createPostEditor({ content: doc([null, null]) });

    const { table, widths } = shownTable(editor);
    expect(table.hasAttribute("data-column-widths")).toBe(false);
    expect(widths.every((width) => !width.endsWith("%"))).toBe(true);
  });
});
