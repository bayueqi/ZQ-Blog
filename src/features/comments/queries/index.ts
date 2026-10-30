import { orpc } from "@/lib/orpc";
import type { CommentTarget } from "../comments.schema";
import { COMMENT_PAGE_SIZE } from "../comment-thread";

/** 评论管理页每页条数。 */
export const ADMIN_COMMENTS_PAGE_SIZE = 20;

export function rootCommentsInfiniteQuery(target: CommentTarget) {
  return orpc.comments.roots.infiniteOptions({
    input: (pageParam: number) => ({
      ...target,
      offset: pageParam,
      limit: COMMENT_PAGE_SIZE,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.items.length < COMMENT_PAGE_SIZE) {
        return undefined;
      }
      return lastPageParam + lastPage.items.length;
    },
  });
}

export function repliesByRootIdInfiniteQuery(
  target: CommentTarget,
  rootId: number,
) {
  return orpc.comments.replies.infiniteOptions({
    input: (pageParam: number) => ({
      ...target,
      rootId,
      offset: pageParam,
      limit: COMMENT_PAGE_SIZE,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length < COMMENT_PAGE_SIZE) {
        return undefined;
      }
      const totalLoaded = allPages.reduce(
        (sum, page) => sum + page.items.length,
        0,
      );
      return totalLoaded;
    },
  });
}

export function commentThreadQuery(target: CommentTarget, commentId: number) {
  return orpc.comments.thread.queryOptions({
    input: { ...target, id: commentId },
  });
}

/** One request for a list of Moments, instead of one per card. */
export function commentCountsQuery(
  targetType: CommentTarget["targetType"],
  targetIds: Array<number>,
) {
  return orpc.comments.counts.queryOptions({
    input: { targetType, targetIds },
  });
}

/** 评论管理页：按口径一页页往下翻。 */
export function adminCommentsInfiniteQuery(
  filter: "all" | "unreplied" | "replied" | "mine",
) {
  return orpc.comments.admin.list.infiniteOptions({
    input: (offset: number) => ({
      filter,
      offset,
      limit: ADMIN_COMMENTS_PAGE_SIZE,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}
