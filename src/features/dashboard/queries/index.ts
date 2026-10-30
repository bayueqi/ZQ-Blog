import { orpc } from "@/lib/orpc";

export const dashboardOverviewQuery = orpc.dashboard.overview.queryOptions();

export const UNREPLIED_COMMENTS_PAGE_SIZE = 20;

/** Every unreplied Comment, a page at a time, for the sheet. */
export const unrepliedCommentsInfiniteQuery =
  orpc.dashboard.unrepliedComments.infiniteOptions({
    input: (beforeId: number | undefined) => ({
      limit: UNREPLIED_COMMENTS_PAGE_SIZE,
      beforeId,
    }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextBeforeId ?? undefined,
  });
