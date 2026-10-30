import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  mediaInfiniteQueryOptions,
  type MediaFilter,
  mediaStatsQuery,
} from "@/features/media/queries";
import { orpc, orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

export function useMediaLibrary() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/admin/media/" });
  const { filter: filterParam, view } = useSearch({ from: "/admin/media/" });
  const filter: MediaFilter = filterParam ?? "all";

  const setFilter = (next: MediaFilter) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        filter: next === "all" ? undefined : next,
      }),
    });
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    isFetchNextPageError,
    refetch,
  } = useInfiniteQuery({
    ...mediaInfiniteQueryOptions("", filter),
  });

  const mediaItems = data?.pages.flatMap((page) => page.items) ?? [];
  const { data: stats } = useQuery(mediaStatsQuery);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.media.key() });

  const deleteMutation = useMutation({
    // 一次删多张时并发发出，别一张一张排队等。
    mutationFn: async (keys: Array<string>) => {
      await Promise.all(keys.map((key) => orpcClient.media.remove({ key })));
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(m.media_deleted());
    },
    onError: () => {
      toast.error(m.media_toast_delete_fail());
    },
  });

  const deleteUnusedMutation = useMutation({
    mutationFn: () => orpcClient.media.removeUnused(),
    onSuccess: async () => {
      await invalidate();
      toast.success(m.media_deleted());
    },
  });

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      void fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  return {
    mediaItems,
    view: view ?? "grid",
    setView: (view: "grid" | "list") =>
      navigate({ search: (prev) => ({ ...prev, view }), replace: true }),
    filter,
    setFilter,
    loadMore,
    hasMore: hasNextPage ?? false,
    isLoadingMore: isFetchingNextPage,
    isPending,
    isError,
    isFetchNextPageError,
    refetch,
    stats,
    deleteKeys: deleteMutation.mutateAsync,
    deleteUnused: deleteUnusedMutation.mutateAsync,
    isDeleting: deleteMutation.isPending || deleteUnusedMutation.isPending,
  };
}
