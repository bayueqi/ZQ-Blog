import { describe, expect, it } from "vitest";
import { filterLanguageOptions } from "./language-options";

const OPTIONS = [
  { id: "typescript", label: "TypeScript", aliases: ["ts"] },
  { id: "javascript", label: "JavaScript", aliases: ["js"] },
  { id: "tsx", label: "TSX", aliases: [] },
  { id: "c", label: "C", aliases: [] },
  { id: "cpp", label: "C++", aliases: [] },
  { id: "csharp", label: "C#", aliases: [] },
  { id: "yaml", label: "YAML", aliases: ["yml"] },
  { id: "text", label: "Plain Text", aliases: [] },
];

const ids = (query: string) =>
  filterLanguageOptions(OPTIONS, query).map((option) => option.id);

describe("filterLanguageOptions", () => {
  it("finds a language by one of its aliases", () => {
    expect(ids("yml")).toEqual(["yaml"]);
  });

  it("matches part of a display name regardless of case", () => {
    expect(ids("SCRIPT")).toEqual(["typescript", "javascript"]);
    expect(ids("plain")).toEqual(["text"]);
  });

  it("finds a language by its grammar id", () => {
    expect(ids("csharp")).toEqual(["csharp"]);
  });

  it("keeps every option in list order for a blank query", () => {
    expect(ids("  ")).toEqual(OPTIONS.map((option) => option.id));
  });

  it("returns nothing when no name matches", () => {
    expect(ids("cobol")).toEqual([]);
  });

  it("ranks exact names above prefixes above other matches", () => {
    expect(ids("c")).toEqual([
      "c",
      "cpp",
      "csharp",
      "typescript",
      "javascript",
    ]);
    expect(ids("ts")).toEqual(["typescript", "tsx"]);
    expect(ids("t")).toEqual(["typescript", "tsx", "text", "javascript"]);
  });
});
