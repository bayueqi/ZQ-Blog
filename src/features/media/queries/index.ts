import { orpc } from "@/lib/orpc";

export type MediaFilter = "all" | "used" | "unused";

export function mediaInfiniteQueryOptions(
  search: string = "",
  filter: MediaFilter = "all",
) {
  return orpc.media.list.infiniteOptions({
    input: (pageParam: number | undefined) => ({
      cursor: pageParam,
      search: search || undefined,
      filter: filter === "all" ? undefined : filter,
    }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function linkedPostsQuery(key: string) {
  return orpc.media.linkedPosts.queryOptions({
    input: { key },
    enabled: !!key,
  });
}

export function linkedGalleriesQuery(key: string) {
  return orpc.media.linkedGalleries.queryOptions({
    input: { key },
    enabled: !!key,
  });
}

export function linkedMomentsQuery(key: string) {
  return orpc.media.linkedMoments.queryOptions({
    input: { key },
    enabled: !!key,
  });
}

export const mediaStatsQuery = orpc.media.stats.queryOptions();
