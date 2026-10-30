import { describe, expect, it } from "vitest";
import { publicCommentPath, targetPagePath } from "./comment-url";

describe("targetPagePath", () => {
  it("keeps posts and gallery categories on their own page", () => {
    expect(targetPagePath({ targetType: "post", slug: "hello" })).toBe(
      "/post/hello",
    );
    expect(targetPagePath({ targetType: "gallery", slug: "internship" })).toBe(
      "/gallery/internship",
    );
  });

  it("anchors a moment, because the timeline has no page of its own", () => {
    expect(targetPagePath({ targetType: "moment", momentId: 7 })).toBe(
      "/moments#moment-7",
    );
  });
});

describe("publicCommentPath", () => {
  it("lands on the comment section of a post", () => {
    expect(publicCommentPath({ targetType: "post", slug: "hello" }, 12)).toBe(
      "/post/hello?comment=12#comments",
    );
  });

  it("lands on the comment section of a gallery category", () => {
    expect(
      publicCommentPath({ targetType: "gallery", slug: "internship" }, 17),
    ).toBe("/gallery/internship?comment=17#comments");
  });

  it("anchors the moment that holds the comment", () => {
    expect(publicCommentPath({ targetType: "moment", momentId: 7 }, 16)).toBe(
      "/moments?comment=16#moment-7",
    );
  });
});
