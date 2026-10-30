import { describe, expect, it } from "vitest";
import { PLAIN_TEXT } from "@/lib/code-languages";
import { highlight } from "@/lib/shiki";
import { isPlainCodeHtml, plainCodeHtml } from "./plain-code-html";

const code = 'const a: number = 1; function f() { return "x"; }';

describe("plainCodeHtml", () => {
  it("escapes markup", () => {
    expect(plainCodeHtml(`<img src=x onerror=alert(1)>`)).toBe(
      `<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>`,
    );
  });
});

describe("isPlainCodeHtml", () => {
  it("recognises the plain fallback", () => {
    expect(isPlainCodeHtml(plainCodeHtml(code))).toBe(true);
  });

  it("recognises what the highlighter renders for plain text", async () => {
    expect(isPlainCodeHtml(await highlight(code, PLAIN_TEXT))).toBe(true);
    expect(isPlainCodeHtml(await highlight(code, "not-a-language"))).toBe(true);
  });

  it("does not match grammar-highlighted HTML", async () => {
    expect(isPlainCodeHtml(await highlight(code, "typescript"))).toBe(false);
  });
});
