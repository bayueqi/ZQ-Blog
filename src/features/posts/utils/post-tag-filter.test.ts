import { describe, expect, it } from "vitest";
import { getNextPostTagFilter } from "./post-tag-filter";

describe("Post Tag filter", () => {
  it("should clear the active filter when All is selected", () => {
    expect(getNextPostTagFilter("TypeScript", undefined)).toEqual({});
  });

  it("should keep the unfiltered state stable when All is selected again", () => {
    expect(getNextPostTagFilter(undefined, undefined)).toEqual({});
  });

  it("should treat the legacy empty selection as All", () => {
    expect(getNextPostTagFilter("TypeScript", "")).toEqual({});
  });

  it("should toggle the active Tag off", () => {
    expect(getNextPostTagFilter("TypeScript", "TypeScript")).toEqual({});
  });

  it("should select a different Tag", () => {
    expect(getNextPostTagFilter("TypeScript", "React")).toEqual({
      tagName: "React",
    });
  });
});
