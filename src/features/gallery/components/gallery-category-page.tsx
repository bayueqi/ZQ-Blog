import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { GalleryLock } from "@/features/gallery/components/gallery-lock";
import type {
  GalleryCategoryCard,
  GalleryPhotoItem,
} from "@/features/gallery/gallery.schema";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { m } from "@/paraglide/messages";

export function GalleryCategoryPage({
  category,
  photos,
  locked,
}: {
  category: GalleryCategoryCard;
  photos: Array<GalleryPhotoItem>;
  locked: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

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
    <section className="space-y-4 fuwari-content-enter">
      <header className="fuwari-card-base space-y-1 p-6">
        <Link
          to="/gallery"
          className="mb-2 flex w-fit items-center gap-1 text-sm fuwari-text-50 hover:text-(--fuwari-primary)"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
          {m.gallery_back_to_all()}
        </Link>
        <h1 className="text-2xl font-semibold fuwari-text-90">
          {concealed ? m.gallery_private_placeholder() : category.name}
        </h1>
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
        <GalleryLock categoryId={category.id} />
      ) : photos.length === 0 ? (
        <div className="fuwari-card-base p-6">
          <EmptyState icon={Images} description={m.gallery_empty_photos()} />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                className="fuwari-card-base block aspect-square w-full overflow-hidden"
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
