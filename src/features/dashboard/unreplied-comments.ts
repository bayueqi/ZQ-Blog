import type { InfiniteData } from "@tanstack/react-query";
import type {
  DashboardOverview,
  UnrepliedCommentsPage,
} from "@/features/dashboard/dashboard.schema";

/** The overview as it reads once Comment `id` has left the unreplied list. */
export function overviewWithoutComment(
  overview: DashboardOverview,
  id: number,
): DashboardOverview {
  const { items, total } = overview.unrepliedComments;
  return {
    ...overview,
    unrepliedComments: {
      items: items.filter((comment) => comment.id !== id),
      total: Math.max(0, total - 1),
    },
  };
}

/** The sheet's loaded pages once Comment `id` has left the unreplied list. */
export function pagesWithoutComment<TPageParam>(
  data: InfiniteData<UnrepliedCommentsPage, TPageParam>,
  id: number,
): InfiniteData<UnrepliedCommentsPage, TPageParam> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((comment) => comment.id !== id),
      total: Math.max(0, page.total - 1),
    })),
  };
}
