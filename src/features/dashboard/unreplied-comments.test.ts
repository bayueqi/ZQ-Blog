import { describe, expect, it } from "vitest";
import type {
  DashboardComment,
  DashboardOverview,
  UnrepliedCommentsPage,
} from "./dashboard.schema";
import {
  overviewWithoutComment,
  pagesWithoutComment,
} from "./unreplied-comments";

const comment = (id: number) => ({ id }) as DashboardComment;

describe("overviewWithoutComment", () => {
  it("drops the comment and counts one fewer", () => {
    const overview = {
      unrepliedComments: { items: [comment(1), comment(2)], total: 7 },
    } as DashboardOverview;
    expect(overviewWithoutComment(overview, 1).unrepliedComments).toEqual({
      items: [comment(2)],
      total: 6,
    });
  });

  it("counts one fewer for a comment beyond the first five", () => {
    const overview = {
      unrepliedComments: { items: [comment(1)], total: 7 },
    } as DashboardOverview;
    expect(overviewWithoutComment(overview, 9).unrepliedComments.total).toBe(6);
  });
});

describe("pagesWithoutComment", () => {
  it("drops the comment from whichever page holds it", () => {
    const page = (ids: Array<number>): UnrepliedCommentsPage => ({
      items: ids.map(comment),
      total: 3,
      nextBeforeId: null,
    });
    const data = {
      pages: [page([3, 2]), page([1])],
      pageParams: [undefined, 2],
    };
    const next = pagesWithoutComment(data, 2);
    expect(next.pages.map((p) => p.items.map((item) => item.id))).toEqual([
      [3],
      [1],
    ]);
    expect(next.pages.map((p) => p.total)).toEqual([2, 2]);
    expect(next.pageParams).toEqual([undefined, 2]);
  });
});
