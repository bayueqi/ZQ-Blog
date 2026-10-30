import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-heading";
import { ACCEPTED_IMAGE_TYPES } from "@/features/media/media.schema";
import { cn, formatBytes } from "@/lib/utils";
import {
  MOTION,
  useContentMotion,
  useMediaQuery,
  useMotionPresence,
} from "@/hooks/use-motion";
import { EmptyState } from "@/components/ui/empty-state";
import { m } from "@/paraglide/messages";
import { MediaDetail, MediaToolbar } from "./components";
import { MediaCollection } from "./components/media-collection";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useMediaLibrary, useMediaUpload } from "./hooks";
import { useMediaScroll } from "./hooks/use-media-scroll";
import { MEDIA_LAYOUT_DURATION } from "./hooks/use-media-grid-motion";
import { MediaCollectionSkeleton } from "./media-library-skeleton";
import type { MediaAsset } from "./types";
import "./media-library.css";

export function MediaLibrary() {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const collectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "one"; asset: MediaAsset } | { kind: "unused" } | null
  >(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const {
    mediaItems,
    filter,
    setFilter,
    view,
    setView,
    loadMore,
    hasMore,
    isLoadingMore,
    isPending,
    isError,
    isFetchNextPageError,
    refetch,
    stats,
    deleteKeys,
    deleteUnused,
    isDeleting,
  } = useMediaLibrary();
  const { uploadFiles, isUploading, progress } = useMediaUpload();
  const active = preview
    ? (mediaItems.find((item) => item.key === preview.key) ?? preview)
    : null;

  const compact = useMediaQuery("(max-width: 1199px)");
  const detailPresent = useMotionPresence(
    !!active,
    compact ? MOTION.modal : MEDIA_LAYOUT_DURATION,
  );
  const retained = useRef<MediaAsset | null>(null);
  if (active) retained.current = active;
  const detailAsset = active ?? retained.current;
  const focusPending = useRef(false);
  useContentMotion(
    contentRef,
    `${view}:${filter}:${isPending}:${mediaItems.map((item) => item.key).join(",")}`,
  );

  const captureAnchor = useMediaScroll(
    collectionRef,
    `${view}:${!!active}`,
    filter,
  );

  useEffect(() => {
    setPreview(null);
  }, [filter]);

  const openFilePicker = () => fileRef.current?.click();
  const closePreview = () => {
    captureAnchor(preview?.key);
    focusPending.current = true;
    setPreview(null);
  };
  useEffect(() => {
    if (detailPresent || !focusPending.current) return;
    focusPending.current = false;
    const fallback =
      collectionRef.current?.querySelector<HTMLButtonElement>("button");
    (selectedTrigger.current?.isConnected
      ? selectedTrigger.current
      : (fallback ?? uploadRef.current)
    )?.focus({ preventScroll: true });
  }, [detailPresent]);
  const handleFiles = (files: FileList | Array<File>) => {
    if (!isUploading) void uploadFiles(Array.from(files));
  };
  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    try {
      if (deleteTarget.kind === "one")
        await deleteKeys([deleteTarget.asset.key]);
      else await deleteUnused();
      setDeleteTarget(null);
      closePreview();
    } catch {
      if (deleteTarget.kind === "unused") toast.error(m.media_delete_fail());
    }
  };
  const isEmpty = !isPending && !isError && mediaItems.length === 0;
  const showBrowserFooter =
    isError ||
    hasMore ||
    isFetchNextPageError ||
    (filter === "unused" && !!stats?.unusedCount);

  return (
    <div
      className="media-workspace admin-workspace fuwari-card-base"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (event.dataTransfer.files.length)
          handleFiles(event.dataTransfer.files);
      }}
    >
      <PageHeader
        className="media-workspace-header"
        title={m.media_title()}
        description={
          stats
            ? m.media_stats({
                count: stats.totalCount,
                size: formatBytes(stats.totalBytes),
              })
            : "—"
        }
        actions={
          <Button
            ref={uploadRef}
            variant="primary"
            icon={<Upload size={17} />}
            disabled={isUploading}
            onClick={openFilePicker}
          >
            {m.media_upload_file()}
          </Button>
        }
      />
      <MediaToolbar
        filter={filter}
        onFilterChange={(value) => {
          setPreview(null);
          setFilter(value);
        }}
        unusedCount={stats?.unusedCount}
        usedCount={
          stats ? Math.max(0, stats.totalCount - stats.unusedCount) : undefined
        }
        totalCount={stats?.totalCount}
        view={view}
        onViewChange={(next) => {
          captureAnchor(preview?.key);
          void setView(next);
        }}
      />
      {progress ? (
        <p role="status" className="media-upload-progress">
          {m.media_uploading({
            current: progress.current,
            total: progress.total,
          })}
        </p>
      ) : null}
      <div className={cn("media-workspace-body", active && "has-preview")}>
        <div
          className="media-browser custom-scrollbar"
          data-scroll-restoration-id="admin-media-list"
          role="region"
          aria-label={m.media_title()}
          tabIndex={0}
          ref={collectionRef}
          aria-busy={isPending}
        >
          <div ref={contentRef} className="media-browser-content">
            {isPending ? (
              <MediaCollectionSkeleton view={view} />
            ) : isError && !mediaItems.length ? (
              <EmptyState
                role="alert"
                description={m.media_load_fail()}
                action={
                  <Button onClick={() => void refetch()}>
                    {m.media_load_retry()}
                  </Button>
                }
              />
            ) : isEmpty ? (
              <EmptyState
                description={
                  filter === "unused"
                    ? m.media_unreferenced_empty()
                    : filter === "used"
                      ? m.media_used_empty()
                      : m.media_empty()
                }
              />
            ) : (
              <>
                <MediaCollection
                  items={mediaItems}
                  view={view}
                  selectedKey={active?.key}
                  onSelect={(asset, trigger) => {
                    if (!active) captureAnchor(asset.key);
                    selectedTrigger.current = trigger;
                    setPreview(asset);
                  }}
                />
                {showBrowserFooter ? (
                  <footer className="media-browser-footer">
                    {isError && !isFetchNextPageError ? (
                      <Button onClick={() => void refetch()}>
                        {m.media_load_retry()}
                      </Button>
                    ) : hasMore || isFetchNextPageError ? (
                      <Button loading={isLoadingMore} onClick={loadMore}>
                        {isLoadingMore
                          ? m.media_grid_loading()
                          : isFetchNextPageError
                            ? m.media_load_retry()
                            : m.media_load_more()}
                      </Button>
                    ) : null}
                    {filter === "unused" && !!stats?.unusedCount ? (
                      <Button
                        variant="text"
                        size="sm"
                        tone="danger"
                        className="media-cleanup"
                        onClick={() => setDeleteTarget({ kind: "unused" })}
                      >
                        {m.media_unused_cleanup()}
                      </Button>
                    ) : null}
                  </footer>
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="media-panel-slot">
          {detailPresent && detailAsset ? (
            <MediaDetail
              open={!!active}
              asset={detailAsset}
              onClose={closePreview}
              onDelete={(asset) => setDeleteTarget({ kind: "one", asset })}
              preventClose={deleteTarget !== null}
            />
          ) : null}
        </div>
      </div>
      {dragging ? (
        <div className="media-drop-overlay">{m.media_drop()}</div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        title={m.media_delete_title()}
        message={
          deleteTarget?.kind === "one"
            ? m.media_delete_one({ name: deleteTarget.asset.fileName })
            : m.media_unused_confirm({ count: stats?.unusedCount ?? 0 })
        }
        confirmLabel={m.media_delete()}
        isDanger
        isLoading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        fallbackFocus={() =>
          collectionRef.current?.querySelector<HTMLButtonElement>("button") ??
          uploadRef.current
        }
      />
    </div>
  );
}
