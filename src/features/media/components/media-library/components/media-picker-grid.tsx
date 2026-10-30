import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import type { useMediaPicker } from "../hooks";
import type { MediaAsset } from "../types";
import { MediaGrid } from "./media-grid";

/**
 * The media library as a grid to pick from: skeleton tiles while loading, an
 * empty note, then tiles that load more as they scroll into view.
 */
export function MediaPickerGrid({
  picker,
  onSelect,
  columnsClassName,
}: {
  picker: ReturnType<typeof useMediaPicker>;
  onSelect: (asset: MediaAsset) => void;
  /** Grid columns, for pickers narrower than the viewport. */
  columnsClassName?: string;
}) {
  const { mediaItems, loadMore, hasMore, isLoadingMore, isPending } = picker;

  if (isPending) {
    return (
      <div
        className={cn(
          "grid gap-3",
          columnsClassName ?? "grid-cols-3 sm:grid-cols-4",
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }
  if (mediaItems.length === 0) {
    return (
      <EmptyState
        size="compact"
        className="py-16"
        description={m.media_empty()}
      />
    );
  }
  return (
    <MediaGrid
      media={mediaItems}
      onSelect={onSelect}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      showMeta={false}
      columnsClassName={columnsClassName}
    />
  );
}
