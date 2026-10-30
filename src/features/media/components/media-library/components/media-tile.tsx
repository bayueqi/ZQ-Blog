import { useMemo, useState } from "react";
import { cn, formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import {
  getMediaThumbSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import type { MediaAsset } from "../types";

export function MediaTile({
  asset,
  selected = false,
  showMeta = true,
  onSelect,
}: {
  asset: MediaAsset;
  selected?: boolean;
  showMeta?: boolean;
  onSelect: (asset: MediaAsset) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const thumbSrc = useMemo(
    () => getMediaThumbSrc(asset.url, PUBLIC_IMAGE_WIDTH.thumb),
    [asset.url],
  );
  const unused =
    asset.postCount === 0 &&
    asset.galleryCount === 0 &&
    asset.momentCount === 0;

  const usageParts: Array<string> = [];
  if (asset.postCount > 0) {
    usageParts.push(m.media_post_count({ count: asset.postCount }));
  }
  if (asset.galleryCount > 0) {
    usageParts.push(m.media_gallery_count({ count: asset.galleryCount }));
  }
  if (asset.momentCount > 0) {
    usageParts.push(m.media_moment_count({ count: asset.momentCount }));
  }
  const usage = usageParts.join(" · ");

  const badges: Array<{
    key: string;
    label: string;
    tone: "primary" | "neutral";
  }> = [];
  if (asset.isCover) {
    badges.push({
      key: "cover",
      label: m.media_badge_cover(),
      tone: "primary",
    });
  }
  if (asset.postCount > 0) {
    badges.push({ key: "post", label: m.media_badge_post(), tone: "neutral" });
  }
  if (asset.galleryCount > 0) {
    badges.push({
      key: "gallery",
      label: m.media_badge_gallery(),
      tone: "neutral",
    });
  }
  if (asset.momentCount > 0) {
    badges.push({
      key: "moment",
      label: m.media_badge_moment(),
      tone: "neutral",
    });
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(asset)}
      className="group flex flex-col gap-2 min-w-0 text-left"
    >
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-xl bg-(--fuwari-btn-regular-bg)",
          selected && "ring-2 ring-(--fuwari-primary)",
          unused && "ring-2 ring-(--fuwari-warning)",
        )}
      >
        {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
        <img
          src={thumbSrc}
          alt={asset.fileName}
          className={cn(
            "h-full w-full object-cover",
            loaded ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
        {unused ? (
          <Badge tone="warning" size="sm" className="absolute top-2 left-2">
            {m.media_badge_unused()}
          </Badge>
        ) : badges.length > 0 ? (
          <div className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {badges.map((badge) => (
              <Badge key={badge.key} tone={badge.tone} size="sm">
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="text-sm truncate fuwari-text-90">{asset.fileName}</div>
        {showMeta ? (
          <div className="mt-0.5 flex justify-between gap-2 text-xs fuwari-text-50">
            {unused ? (
              <span className="text-(--fuwari-warning-fg)">
                {m.media_badge_unused()}
              </span>
            ) : (
              <span className="min-w-0 truncate">{usage}</span>
            )}
            <span className="shrink-0">{formatBytes(asset.sizeInBytes)}</span>
          </div>
        ) : null}
      </div>
    </button>
  );
}
