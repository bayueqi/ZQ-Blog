import { Skeleton } from "@/components/ui/skeleton";
import type { MediaView } from "./components/media-toolbar";
import "@/components/ui/page-heading.css";
import "./media-library.css";

export function MediaCollectionSkeleton({
  view = "grid",
}: {
  view?: MediaView;
}) {
  return (
    <div className={view === "grid" ? "media-gallery" : "media-list-skeleton"}>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index}>
          <Skeleton className="media-skeleton-image" />
          <Skeleton className="media-skeleton-label" />
        </div>
      ))}
    </div>
  );
}

export function MediaLibraryPageSkeleton() {
  return (
    <div className="media-workspace admin-workspace fuwari-card-base">
      <div className="fuwari-page-header media-workspace-header">
        <Skeleton className="media-skeleton-label" />
      </div>
      <div className="media-workspace-toolbar" />
      <MediaCollectionSkeleton />
    </div>
  );
}
