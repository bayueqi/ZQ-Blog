import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  History,
  ImagePlus,
  Images,
  Lock,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-heading";
import {
  GalleryCategoryDialog,
  type GalleryCategoryRow,
} from "@/features/gallery/components/admin/gallery-dialogs";
import "@/features/gallery/components/admin/gallery-workspace.css";
import "@/features/posts/components/post-manager/post-manager.css";
import { PostStatusBadge } from "@/features/posts/components/post-status-badge";
import {
  adminGalleryCategoriesQuery,
  adminGalleryPhotosQuery,
} from "@/features/gallery/queries";
import {
  RevisionHistoryDialog,
  type RevisionTarget,
} from "@/features/revisions/components/revision-history-dialog";
import { MediaPicker } from "@/features/media/components/media-library/components";
import {
  getPublicImageSrc,
  isVideoMime,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { orpcClient } from "@/lib/orpc";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/gallery/")({
  ssr: false,
  validateSearch: z.object({
    collection: z.number().optional().catch(undefined),
  }),
  component: AdminGalleryPage,
  loader: () => ({
    title: m.admin_gallery_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function AdminGalleryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { collection } = Route.useSearch();
  const [categoryId, setCategoryId] = useState<number | null>(
    collection ?? null,
  );

  // 从媒体库的引用条目点进来时带着 collection，直接展开对应相册集。
  useEffect(() => {
    if (collection != null) setCategoryId(collection);
  }, [collection]);

  const openCategory = (id: number | null) => {
    setCategoryId(id);
    if (collection != null) {
      void navigate({ to: "/admin/gallery", search: {}, replace: true });
    }
  };

  const categories = useQuery(adminGalleryCategoriesQuery());
  const photos = useQuery({
    ...adminGalleryPhotosQuery(categoryId ?? 0),
    enabled: categoryId !== null,
  });

  const [dialog, setDialog] = useState<{
    open: boolean;
    row: GalleryCategoryRow | null;
  }>({ open: false, row: null });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleting, setDeleting] = useState<GalleryCategoryRow | null>(null);
  /** 正在翻历史版本的那个相册集。 */
  const [history, setHistory] = useState<RevisionTarget | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);

  const allCategories = (categories.data?.categories ??
    []) as Array<GalleryCategoryRow>;
  const allPhotos = photos.data?.photos ?? [];
  const current = allCategories.find((item) => item.id === categoryId) ?? null;

  // 灯箱：Esc 关闭，左右键翻页。
  useEffect(() => {
    if (preview === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
      if (allPhotos.length < 2) return;
      if (event.key === "ArrowLeft") {
        setPreview((index) =>
          index === null
            ? index
            : (index - 1 + allPhotos.length) % allPhotos.length,
        );
      }
      if (event.key === "ArrowRight") {
        setPreview((index) =>
          index === null ? index : (index + 1) % allPhotos.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, allPhotos.length]);

  const refresh = async () => {
    await queryClient.invalidateQueries();
  };

  async function addPhoto(mediaId: number) {
    if (categoryId === null) return;
    try {
      await orpcClient.gallery.admin.photos.add({ categoryId, mediaId });
      toast.success(m.admin_gallery_saved());
      await refresh();
    } catch {
      toast.error(m.admin_gallery_failed());
    } finally {
      setPickerOpen(false);
    }
  }

  async function removePhoto(id: number) {
    try {
      await orpcClient.gallery.admin.photos.remove({ id });
      await refresh();
    } catch {
      toast.error(m.admin_gallery_failed());
    }
  }

  async function togglePin(row: GalleryCategoryRow) {
    try {
      await orpcClient.gallery.admin.categories.pin({
        id: row.id,
        pinned: !row.pinned,
      });
      toast.success(
        row.pinned ? m.admin_unpinned_toast() : m.admin_pinned_toast(),
      );
      await refresh();
    } catch {
      toast.error(m.admin_gallery_failed());
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await orpcClient.gallery.admin.categories.remove({ id: deleting.id });
      if (categoryId === deleting.id) openCategory(null);
      toast.success(m.admin_gallery_deleted());
      setDeleting(null);
      await refresh();
    } catch {
      toast.error(m.admin_gallery_failed());
    } finally {
      setDeletingBusy(false);
    }
  }

  const actions =
    categoryId === null ? (
      <Button
        variant="primary"
        icon={<Plus size={17} />}
        onClick={() => setDialog({ open: true, row: null })}
      >
        {m.admin_gallery_new()}
      </Button>
    ) : (
      <Button
        variant="primary"
        icon={<ImagePlus size={17} />}
        onClick={() => setPickerOpen(true)}
      >
        {m.admin_gallery_upload()}
      </Button>
    );

  return (
    <div className="gallery-workspace admin-workspace fuwari-card-base">
      <PageHeader
        className="gallery-header"
        title={current?.name ?? m.admin_gallery_title()}
        description={
          current
            ? m.admin_gallery_photos_total({ count: allPhotos.length })
            : m.admin_gallery_overview({
                collections: allCategories.length,
                photos: allCategories.reduce(
                  (total, row) => total + row.photoCount,
                  0,
                ),
              })
        }
        actions={actions}
      />

      {current && (
        <nav className="gallery-crumbs" aria-label={m.admin_gallery_title()}>
          <button
            type="button"
            className="gallery-crumb"
            onClick={() => openCategory(null)}
          >
            {m.admin_gallery_title()}
          </button>
          <span className="gallery-crumb-sep">/</span>
          <span className="gallery-crumb" aria-current="true">
            {current.name}
          </span>
        </nav>
      )}

      <div className="gallery-body custom-scrollbar">
        {categoryId === null ? (
          categories.isPending ? (
            <GallerySkeleton count={3} />
          ) : allCategories.length === 0 ? (
            <div className="gallery-empty">
              <EmptyState description={m.admin_gallery_empty()} />
            </div>
          ) : (
            <div className="post-list-table-wrap">
              <table className="post-list-table">
                <colgroup>
                  <col style={{ width: "44%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">{m.admin_gallery_col_name()}</th>
                    <th scope="col">{m.admin_posts_filter_status()}</th>
                    <th scope="col">{m.admin_posts_time_published()}</th>
                    <th scope="col">{m.admin_posts_time_modified()}</th>
                    <th scope="col">{m.admin_posts_col_actions()}</th>
                  </tr>
                </thead>
                <tbody>
                  {allCategories.map((row) => {
                    const scheduled =
                      row.published &&
                      row.publishedAt != null &&
                      new Date(row.publishedAt).getTime() > Date.now();
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="post-list-title-cell">
                            <span className="post-list-pin">
                              {row.pinned ? (
                                <Pin size={18} aria-label={m.pinned_badge()} />
                              ) : null}
                            </span>
                            <button
                              type="button"
                              className="flex min-w-0 items-center gap-2.5 text-left"
                              onClick={() => openCategory(row.id)}
                            >
                              {row.cover ? (
                                <img
                                  src={getPublicImageSrc(
                                    row.cover.url,
                                    PUBLIC_IMAGE_WIDTH.avatar,
                                  )}
                                  alt=""
                                  loading="lazy"
                                  className="h-10 w-10 shrink-0 rounded object-cover"
                                />
                              ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-(--fuwari-btn-regular-bg) fuwari-text-30">
                                  <Images size={16} strokeWidth={1.5} />
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="post-list-title-line">
                                  <strong>{row.name}</strong>
                                  {row.hasAccessPassword ? (
                                    <Lock
                                      size={12}
                                      strokeWidth={2}
                                      className="post-list-lock"
                                      aria-label={m.gallery_locked_badge()}
                                    />
                                  ) : null}
                                </span>
                                <span className="post-list-slug">
                                  {row.description ||
                                    m.gallery_photo_count({
                                      count: row.photoCount,
                                    })}
                                </span>
                              </span>
                            </button>
                          </div>
                        </td>
                        <td>
                          <PostStatusBadge
                            published={row.published}
                            scheduled={scheduled}
                          />
                        </td>
                        <td className="post-list-date">
                          {row.publishedAt ? formatDate(row.publishedAt) : "—"}
                        </td>
                        <td className="post-list-date">
                          {row.updatedAt ? formatDate(row.updatedAt) : "—"}
                        </td>
                        <td>
                          <div className="flex items-center gap-0.5">
                            <IconButton
                              label={
                                row.pinned
                                  ? m.admin_gallery_unpin()
                                  : m.admin_gallery_pin()
                              }
                              onClick={() => void togglePin(row)}
                            >
                              {row.pinned ? (
                                <PinOff size={15} />
                              ) : (
                                <Pin size={15} />
                              )}
                            </IconButton>
                            <IconButton
                              label={m.admin_gallery_edit()}
                              onClick={() => setDialog({ open: true, row })}
                            >
                              <Pencil size={15} />
                            </IconButton>
                            <IconButton
                              label={m.admin_revisions_open()}
                              onClick={() =>
                                setHistory({
                                  type: "gallery",
                                  id: row.id,
                                })
                              }
                            >
                              <History size={15} />
                            </IconButton>
                            <IconButton
                              label={m.admin_gallery_delete()}
                              tone="danger"
                              onClick={() => setDeleting(row)}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : photos.isPending ? (
          <GallerySkeleton count={6} square />
        ) : allPhotos.length === 0 ? (
          <div className="gallery-empty">
            <p className="fuwari-text-50 text-sm">
              {m.admin_gallery_empty_photos()}
            </p>
          </div>
        ) : (
          <ul className="gallery-photo-grid">
            {allPhotos.map((photo, index) => (
              <li key={photo.id} className="gallery-photo">
                <button
                  type="button"
                  className="gallery-photo-open"
                  aria-label={m.media_preview_title()}
                  onClick={() => setPreview(index)}
                >
                  {isVideoMime(photo.mimeType) ? (
                    <video
                      src={photo.url}
                      muted
                      playsInline
                      preload="metadata"
                      aria-label={photo.caption ?? ""}
                      onLoadedMetadata={(event) => {
                        event.currentTarget.currentTime = 0.1;
                      }}
                    />
                  ) : (
                    <img
                      src={getPublicImageSrc(
                        photo.url,
                        PUBLIC_IMAGE_WIDTH.cover,
                      )}
                      alt={photo.caption ?? ""}
                      loading="lazy"
                    />
                  )}
                </button>
                <button
                  type="button"
                  className="gallery-photo-remove"
                  aria-label={m.admin_gallery_delete()}
                  onClick={() => void removePhoto(photo.id)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <GalleryCategoryDialog
        key={`category-${dialog.open ? "open" : "closed"}-${dialog.row?.id ?? "new"}`}
        open={dialog.open}
        row={dialog.row}
        onClose={() => setDialog({ open: false, row: null })}
        onSaved={refresh}
      />
      <MediaPicker
        open={pickerOpen}
        title={m.admin_gallery_upload()}
        onClose={() => setPickerOpen(false)}
        onSelect={(media) => void addPhoto(media.id)}
      />
      <ConfirmationModal
        isOpen={deleting !== null}
        isLoading={deletingBusy}
        isDanger
        title={m.admin_gallery_delete()}
        message={
          deleting
            ? m.admin_gallery_delete_confirm({ name: deleting.name })
            : ""
        }
        confirmLabel={m.admin_gallery_delete()}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
      <RevisionHistoryDialog
        target={history}
        onClose={() => setHistory(null)}
        onRestored={refresh}
      />
      {preview !== null && allPhotos[preview]
        ? createPortal(
            // 挂到 body，免得页面动画的 transform 把 fixed 关进内容区。
            <div
              className="gallery-lightbox"
              role="presentation"
              onClick={() => setPreview(null)}
            >
              <button
                type="button"
                className="gallery-lightbox-close"
                aria-label={m.gallery_close()}
                onClick={() => setPreview(null)}
              >
                <X size={18} />
              </button>
              {allPhotos.length > 1 ? (
                <button
                  type="button"
                  className="gallery-lightbox-prev"
                  aria-label={m.gallery_prev()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreview(
                      (preview - 1 + allPhotos.length) % allPhotos.length,
                    );
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              {isVideoMime(allPhotos[preview].mimeType) ? (
                <video
                  src={allPhotos[preview].url}
                  controls
                  autoPlay
                  playsInline
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <img
                  src={getPublicImageSrc(
                    allPhotos[preview].url,
                    PUBLIC_IMAGE_WIDTH.zoom,
                  )}
                  alt={allPhotos[preview].caption ?? ""}
                  onClick={(event) => event.stopPropagation()}
                />
              )}
              {allPhotos.length > 1 ? (
                <button
                  type="button"
                  className="gallery-lightbox-next"
                  aria-label={m.gallery_next()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreview((preview + 1) % allPhotos.length);
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function GallerySkeleton({
  count,
  square = false,
}: {
  count: number;
  square?: boolean;
}) {
  if (square) {
    return (
      <div className="gallery-photo-grid" aria-busy="true">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="gallery-card-thumb" />
        ))}
      </div>
    );
  }
  return (
    <div className="post-list-table-wrap" aria-busy="true">
      <table className="post-list-table">
        <tbody>
          {Array.from({ length: count }, (_, index) => (
            <tr key={index}>
              <td colSpan={5}>
                <div className="h-8 animate-pulse rounded bg-(--fuwari-btn-regular-bg)" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
