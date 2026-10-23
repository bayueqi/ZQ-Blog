import { Link } from "@tanstack/react-router";
import { Images, Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { GalleryCategoryCard } from "@/features/gallery/gallery.schema";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import { formatDate } from "@/lib/utils";
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
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            // 锁着又开了隐私保护：名称、描述、封面、张数、时间都不露。
            const concealed = category.locked && category.privacyProtected;
            return (
              <li key={category.id}>
                <Link
                  to="/gallery/$category"
                  params={{ category: category.slug }}
                  className="group fuwari-card-base block overflow-hidden transition-transform hover:-translate-y-0.5"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-black/5 dark:bg-white/5">
                    {!concealed && category.cover ? (
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
                    {category.locked && (
                      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs text-white">
                        <Lock size={12} strokeWidth={2} />
                        {m.gallery_locked_badge()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <h2 className="font-medium fuwari-text-90">
                      {concealed
                        ? m.gallery_private_placeholder()
                        : category.name}
                    </h2>
                    {!concealed && category.description && (
                      <p className="line-clamp-2 text-sm fuwari-text-50">
                        {category.description}
                      </p>
                    )}
                    {!concealed && (
                      <p className="pt-1 text-xs fuwari-text-50">
                        {m.gallery_photo_count({ count: category.photoCount })}
                        {category.createdAt ? (
                          <>
                            {" · "}
                            {m.gallery_created_at({
                              date: formatDate(category.createdAt),
                            })}
                          </>
                        ) : null}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
