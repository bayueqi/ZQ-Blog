import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Clock, Lock, Pin, Tag } from "lucide-react";
import {
  getPublicImageSrc,
  getPublicImageSrcSet,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import { m } from "@/paraglide/messages";

interface ArchivePostProps {
  post: PostItem;
}

export function ArchivePost({ post }: ArchivePostProps) {
  const date = post.publishedAt ? new Date(post.publishedAt) : null;
  // 隐私保护：归档里也只留占位，标题、日期、分类、标签、摘要、封面都不显示。
  const concealed = post.privacyProtected;
  const hasCover = Boolean(post.cover) && !concealed;
  const tagNames = (post.tags ?? []).map((tag) => tag.name);

  return (
    <Link
      to="/post/$slug"
      params={{ slug: post.slug }}
      className="group block! my-1 w-full rounded-xl px-2 py-3 transition-colors hover:bg-(--fuwari-btn-plain-bg-hover) active:bg-(--fuwari-btn-plain-bg-active) md:px-3"
      aria-label={concealed ? m.post_private_placeholder() : post.title}
    >
      <div className="flex flex-row justify-start items-stretch">
        {/* Date */}
        <div className="w-[15%] shrink-0 pt-1 text-sm text-right fuwari-text-50 md:w-[10%]">
          <time dateTime={date?.toISOString()}>
            {concealed ? "" : formatPublicPostDate(date, { monthDay: true })}
          </time>
        </div>

        {/* Dot and Line */}
        <div className="w-[15%] shrink-0 relative fuwari-timeline-dash flex items-start pt-2.5 md:w-[10%]">
          <div
            className="transition-all mx-auto w-1 h-1 rounded group-hover:h-5
              bg-black/50 dark:bg-white/50 group-hover:bg-(--fuwari-primary)
              outline z-50
              outline-(--fuwari-card-bg)
              group-hover:outline-(--fuwari-btn-plain-bg-hover)
              group-active:outline-(--fuwari-btn-plain-bg-active)"
          />
        </div>

        {/* Title, meta, summary */}
        <div className="flex min-w-0 flex-1 gap-4 pr-2 md:pr-3">
          <div className="min-w-0 flex-1">
            <div
              className="flex items-center gap-1.5 text-base font-bold transition-all
                group-hover:translate-x-1 group-hover:text-(--fuwari-primary)
                fuwari-text-75 md:text-lg"
            >
              {post.pinnedAt && !concealed ? (
                <Pin
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 fill-current text-(--fuwari-primary)"
                  role="img"
                  aria-label={m.home_pinned_posts()}
                />
              ) : null}
              <span className="min-w-0 truncate">
                {concealed ? m.post_private_placeholder() : post.title}
              </span>
              {concealed || post.visibility !== "password" ? null : (
                <Lock
                  size={12}
                  strokeWidth={2}
                  role="img"
                  aria-label={m.post_locked_badge()}
                  className="shrink-0 text-(--fuwari-fg-50)"
                />
              )}
              <ChevronRight
                size={16}
                strokeWidth={2}
                className="shrink-0 -translate-x-1 text-(--fuwari-primary) opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
              />
            </div>

            <div
              className={
                concealed
                  ? "hidden"
                  : "mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm fuwari-text-50"
              }
            >
              {post.category ? (
                <span className="inline-flex items-center gap-1">
                  <BookOpen size={14} strokeWidth={1.6} />
                  {post.category.name}
                </span>
              ) : null}
              {tagNames.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Tag size={14} strokeWidth={1.6} />
                  {tagNames.join(" / ")}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Clock size={14} strokeWidth={1.6} />
                {m.read_time({ count: post.readTimeInMinutes })}
              </span>
            </div>

            {concealed || !post.summary ? null : (
              <p className="mt-1.5 line-clamp-1 break-words text-sm fuwari-text-50 md:line-clamp-2">
                {post.summary}
              </p>
            )}
          </div>

          {hasCover && post.cover ? (
            <div className="my-auto hidden shrink-0 overflow-hidden rounded-lg sm:block">
              <img
                src={getPublicImageSrc(
                  post.cover.url,
                  PUBLIC_IMAGE_WIDTH.cover,
                )}
                srcSet={getPublicImageSrcSet(post.cover.url, [
                  PUBLIC_IMAGE_WIDTH.cover,
                  PUBLIC_IMAGE_WIDTH.cover * 2,
                ])}
                sizes="(min-width: 768px) 9rem, 7rem"
                alt={post.title}
                width={post.cover.width ?? undefined}
                height={post.cover.height ?? undefined}
                loading="lazy"
                className="h-16 w-28 object-cover transition group-hover:scale-105 md:h-20 md:w-36"
              />
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
