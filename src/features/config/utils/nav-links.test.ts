import { describe, expect, it } from "vitest";
import {
  canonicalizeNavHref,
  isExternalNavHref,
  isNavHref,
  normalizeNavLinks,
} from "./nav-links";

describe("nav href", () => {
  it("treats http(s) as external and root paths as internal", () => {
    expect(isExternalNavHref("https://github.com/bayueqi")).toBe(true);
    expect(isExternalNavHref("/post/about")).toBe(false);
    expect(isNavHref("/post/about")).toBe(true);
    expect(isNavHref("//evil.example")).toBe(false);
    expect(isNavHref("javascript:alert(1)")).toBe(false);
  });

  it("fills https for host-like addresses", () => {
    expect(canonicalizeNavHref("github.com/bayueqi")).toBe(
      "https://github.com/bayueqi",
    );
    expect(canonicalizeNavHref("/post/about")).toBe("/post/about");
    expect(canonicalizeNavHref("about")).toBe("about");
  });

  it("normalizes stored nav links", () => {
    expect(
      normalizeNavLinks([
        { label: "  About ", href: " /post/about " },
        { label: "GitHub", href: "github.com/bayueqi" },
        { label: "Nope", href: "ftp://example.com" },
      ]),
    ).toEqual([
      { label: "About", href: "/post/about" },
      { label: "GitHub", href: "https://github.com/bayueqi" },
    ]);
  });
});
