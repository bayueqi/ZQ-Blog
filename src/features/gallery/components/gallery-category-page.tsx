import { ClientOnly, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { CommentSection } from "@/features/comments/components/comment-section";
import { GalleryLock } from "@/features/gallery/components/gallery-lock";
import { authClient } from "@/lib/auth/auth-client";
import type {
  GalleryCategoryCard,
  GalleryPhotoItem,
} from "@/features/gallery/gallery.schema";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { ShareButton } from "@/features/share/share-dialog";
import { m } from "@/paraglide/messages";

export function GalleryCategoryPage({
  category,
  photos,
  locked,
  highlightCommentId,
}: {
  category: GalleryCategoryCard;
  photos: Array<GalleryPhotoItem>;
  locked: boolean;
  /** 从通知或评论管理跳进来时要定位到的那条评论。 */
  highlightCommentId?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { data: session } = authClient.useSession();

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (delta: number) => {
      setActive((current) => {
        if (current === null) return current;
        const next = current + delta;
        if (next < 0) return photos.length - 1;
        if (next >= photos.length) return 0;
        return next;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    if (active === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, step]);

  const current = active === null ? null : photos[active];
  // 锁着又开了隐私保护：标题、描述、张数都不显示。
  const concealed = locked && category.privacyProtected;

  return (
    <section className="fuwari-card-base fuwari-content-enter">
      <header className="space-y-1 p-6">
        <Link
          to="/gallery"
          className="mb-2 flex w-fit items-center gap-1 text-sm fuwari-text-50 hover:text-(--fuwari-primary)"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          {m.gallery_back_to_all()}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold fuwari-text-90">
            {concealed ? m.gallery_private_placeholder() : category.name}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            <ShareButton size="md" path={`/gallery/${category.slug}`} />
            <ClientOnly>
              {session?.user.role === "admin" ? (
                <Link
                  to="/admin/gallery"
                  search={{ collection: category.id }}
                  className="flex shrink-0 items-center gap-1.5 text-sm fuwari-text-50 transition-colors hover:text-(--fuwari-primary)"
                >
                  <Pencil size={14} strokeWidth={1.8} />
                  {m.gallery_edit_admin()}
                </Link>
              ) : null}
            </ClientOnly>
          </div>
        </div>
        {!concealed && category.description && (
          <p className="text-sm fuwari-text-50">{category.description}</p>
        )}
        {!concealed && (
          <p className="text-xs fuwari-text-50">
            {m.gallery_photo_count({ count: category.photoCount })}
          </p>
        )}
      </header>

      {locked ? (
        <div className="px-6 pb-6">
          <GalleryLock categoryId={category.id} />
        </div>
      ) : photos.length === 0 ? (
        <div className="px-6 pb-6">
          <EmptyState description={m.gallery_empty_photos()} />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                className="block aspect-square w-full overflow-hidden rounded-xl"
              >
                <img
                  src={getPublicImageSrc(photo.url, PUBLIC_IMAGE_WIDTH.cover)}
                  alt={photo.caption ?? category.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                />
              </button>
              {photo.caption && (
                <p className="mt-1 truncate px-1 text-xs fuwari-text-50">
                  {photo.caption}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {locked ? null : (
        <div className="border-t border-(--fuwari-meta-divider) p-6">
          <CommentSection
            target={{ targetType: "gallery", targetId: category.id }}
            highlightCommentId={highlightCommentId}
          />
        </div>
      )}

      {current &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
            onClick={close}
            role="presentation"
          >
            <button
              type="button"
              onClick={close}
              aria-label={m.gallery_close()}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X size={18} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
              aria-label={m.gallery_prev()}
              className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <ChevronLeft size={20} />
            </button>
            <img
              src={getPublicImageSrc(current.url, PUBLIC_IMAGE_WIDTH.zoom)}
              alt={current.caption ?? category.name}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[90vh] max-w-full rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
              aria-label={m.gallery_next()}
              className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <ChevronRight size={20} />
            </button>
            {current.caption && (
              <p className="absolute bottom-5 max-w-[90vw] text-center text-sm text-white/80">
                {current.caption}
              </p>
            )}
          </div>,
          document.body,
        )}
    </section>
  );
}
