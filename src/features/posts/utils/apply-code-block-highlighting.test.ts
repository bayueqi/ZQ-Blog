import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";
import {
  applyCodeBlockHighlighting,
  codeBlockHighlightKey,
  snapshotHighlightedHtmlByKey,
} from "./apply-code-block-highlighting";

// Captured from `highlight("const answer = 42;", lang)` in src/lib/shiki.ts.
const SHIKI_PRE =
  '<pre class="shiki shiki-themes vitesse-light vitesse-dark" style="background-color:#ffffff;--shiki-dark-bg:#18181b;color:#393a34;--shiki-dark:#dbd7caee" tabindex="0">';
const SHIKI_PLAIN_TEXT = `${SHIKI_PRE}<code><span class="line"><span>const answer = 42;</span></span></code></pre>`;
const SHIKI_TYPESCRIPT = `${SHIKI_PRE}<code><span class="line"><span style="color:#AB5959;--shiki-dark:#CB7676">const</span><span style="color:#B07D48;--shiki-dark:#BD976A"> answer</span><span style="color:#999999;--shiki-dark:#666666"> =</span><span style="color:#2F798A;--shiki-dark:#4C9A91"> 42</span><span style="color:#999999;--shiki-dark:#666666">;</span></span></code></pre>`;
// What publishing stores when highlighting throws (`plainCodeHtml`).
const ERROR_FALLBACK = "<pre><code>const answer = 42;</code></pre>";

function codeDoc(
  blocks: Array<{
    language?: string;
    text: string;
    highlightedHtml?: string;
  }>,
  extra?: Array<JSONContent>,
): JSONContent {
  return {
    type: "doc",
    content: [
      ...(extra ?? []),
      ...blocks.map((block) => ({
        type: "codeBlock",
        attrs: {
          language: block.language ?? "ts",
          ...(block.highlightedHtml
            ? { highlightedHtml: block.highlightedHtml }
            : {}),
        },
        content: [{ type: "text", text: block.text }],
      })),
    ],
  };
}

describe("applyCodeBlockHighlighting", () => {
  it("keeps snapshot HTML when language and source text are unchanged", () => {
    const result = applyCodeBlockHighlighting(
      codeDoc([{ language: "ts", text: "const answer = 42;" }]),
      codeDoc([
        {
          language: "ts",
          text: "const answer = 42;",
          highlightedHtml: "<pre>kept</pre>",
        },
      ]),
    );

    expect(result?.content?.[0]?.attrs?.highlightedHtml).toBe(
      "<pre>kept</pre>",
    );
  });

  it("drops snapshot HTML when source text changes", () => {
    const result = applyCodeBlockHighlighting(
      codeDoc([{ language: "ts", text: "const answer = 43;" }]),
      codeDoc([
        {
          language: "ts",
          text: "const answer = 42;",
          highlightedHtml: "<pre>stale</pre>",
        },
      ]),
    );

    expect(result?.content?.[0]?.attrs?.highlightedHtml).toBeUndefined();
  });

  it.each([
    ["Shiki plain text", SHIKI_PLAIN_TEXT],
    ["error fallback", ERROR_FALLBACK],
  ])(
    "drops %s HTML once the language resolves to a grammar",
    (_, plainHtml) => {
      const result = applyCodeBlockHighlighting(
        codeDoc([{ language: "ts", text: "const answer = 42;" }]),
        codeDoc([
          {
            language: "ts",
            text: "const answer = 42;",
            highlightedHtml: plainHtml,
          },
        ]),
      );

      expect(result?.content?.[0]?.attrs?.highlightedHtml).toBeUndefined();
    },
  );

  it("keeps grammar-highlighted snapshot HTML", () => {
    const result = applyCodeBlockHighlighting(
      codeDoc([{ language: "ts", text: "const answer = 42;" }]),
      codeDoc([
        {
          language: "ts",
          text: "const answer = 42;",
          highlightedHtml: SHIKI_TYPESCRIPT,
        },
      ]),
    );

    expect(result?.content?.[0]?.attrs?.highlightedHtml).toBe(SHIKI_TYPESCRIPT);
  });

  it.each([
    ["Shiki plain text", SHIKI_PLAIN_TEXT],
    ["error fallback", ERROR_FALLBACK],
  ])("keeps %s HTML while the language has no grammar", (_, plainHtml) => {
    for (const language of ["not-a-language", "text"]) {
      const result = applyCodeBlockHighlighting(
        codeDoc([{ language, text: "const answer = 42;" }]),
        codeDoc([
          { language, text: "const answer = 42;", highlightedHtml: plainHtml },
        ]),
      );

      expect(result?.content?.[0]?.attrs?.highlightedHtml).toBe(plainHtml);
    }
  });

  it("strips highlighted HTML that was already on the draft", () => {
    const result = applyCodeBlockHighlighting(
      codeDoc([
        { text: "const answer = 42;", highlightedHtml: "<pre>draft</pre>" },
      ]),
      null,
    );

    expect(result?.content?.[0]?.attrs?.highlightedHtml).toBeUndefined();
  });
});

describe("snapshotHighlightedHtmlByKey", () => {
  it("indexes snapshot HTML by language and source text", () => {
    const map = snapshotHighlightedHtmlByKey(
      codeDoc([
        {
          language: "ts",
          text: "const answer = 42;",
          highlightedHtml: "<pre>kept</pre>",
        },
      ]),
    );

    expect(map.get(codeBlockHighlightKey("ts", "const answer = 42;"))).toBe(
      "<pre>kept</pre>",
    );
  });

  it("leaves out plain-text HTML whose language now resolves to a grammar", () => {
    const map = snapshotHighlightedHtmlByKey(
      codeDoc([
        {
          language: "ts",
          text: "const answer = 42;",
          highlightedHtml: SHIKI_PLAIN_TEXT,
        },
      ]),
    );

    expect(map.has(codeBlockHighlightKey("ts", "const answer = 42;"))).toBe(
      false,
    );
  });

  it("returns an empty map when there is no snapshot", () => {
    expect(snapshotHighlightedHtmlByKey(null).size).toBe(0);
  });
});
