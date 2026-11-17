import { Link } from "@tanstack/react-router";
import { Images, Lock, Pin } from "lucide-react";
import { PublicDateMeta } from "@/components/common/public-date-meta";
import { EmptyState } from "@/components/ui/empty-state";
import type { GalleryCategoryCard } from "@/features/gallery/gallery.schema";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { m } from "@/paraglide/messages";

export function GalleryIndexPage({
  categories,
}: {
  categories: Array<GalleryCategoryCard>;
}) {
  return (
    <section className="fuwari-card-base p-6 fuwari-content-enter">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold fuwari-text-90">
          {m.gallery_title()}
        </h1>
      </header>

      {categories.length === 0 ? (
        <EmptyState description={m.gallery_empty()} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {categories.map((category) => {
            // 设了密码就是私密：名称、描述、封面、张数、时间都不露，也不给链接。
            const concealed = category.locked;
            const card = (
              <>
                <div className="relative aspect-4/3 overflow-hidden bg-black/5 dark:bg-white/5">
                  {category.cover ? (
                    <img
                      src={getPublicImageSrc(
                        category.cover.url,
                        PUBLIC_IMAGE_WIDTH.cover,
                      )}
                      alt={category.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center fuwari-text-50">
                      {concealed ? (
                        <Lock size={28} strokeWidth={1.5} />
                      ) : (
                        <Images size={28} strokeWidth={1.5} />
                      )}
                    </div>
                  )}
                  {category.pinned && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs text-white">
                      <Pin
                        size={12}
                        strokeWidth={2}
                        className="fill-current"
                      />
                      {m.pinned_badge()}
                    </span>
                  )}
                  {concealed && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs text-white">
                      <Lock size={12} strokeWidth={2} />
                      {m.gallery_locked_badge()}
                    </span>
                  )}
                </div>
                <div className="space-y-3 p-5">
                  <h2 className="text-xl font-bold fuwari-text-90 transition group-hover:text-(--fuwari-primary)">
                    {concealed
                      ? m.gallery_private_placeholder()
                      : category.name}
                  </h2>
                  {category.description && (
                    <p className="line-clamp-2 text-sm fuwari-text-50">
                      {category.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <PublicDateMeta
                      publishedAt={category.publishedAt}
                      updatedAt={category.updatedAt}
                    />
                    <div className="flex items-center">
                      <div className="fuwari-meta-icon">
                        <Images strokeWidth={1.5} size={20} />
                      </div>
                      <span className="text-sm font-medium fuwari-text-50">
                        {m.gallery_photo_count({ count: category.photoCount })}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            );

            return (
              <li key={category.id}>
                {concealed ? (
                  <div className="fuwari-card-base block overflow-hidden">
                    {card}
                  </div>
                ) : (
                  <Link
                    to="/gallery/$category"
                    params={{ category: category.slug }}
                    className="group fuwari-card-base block overflow-hidden transition-transform hover:-translate-y-0.5"
                  >
                    {card}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
