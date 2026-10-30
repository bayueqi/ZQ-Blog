import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Images,
  Lock,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";
import type { GalleryCategoryCard } from "@/features/gallery/gallery.schema";
import {
  getPublicImageSrc,
  PUBLIC_IMAGE_WIDTH,
} from "@/features/media/utils/media.utils";
import type { MomentCard } from "@/features/moments/moments.schema";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import type { SiteStats } from "@/features/stats/stats.schema";
import { m } from "@/paraglide/messages";

interface HomePageProps {
  stats: SiteStats;
  pinnedPosts: Array<PostItem>;
  moments: Array<MomentCard>;
  galleries: Array<GalleryCategoryCard>;
}

export function HomePage({
  stats,
  pinnedPosts,
  moments,
  galleries,
}: HomePageProps) {
  const pinnedMoments = moments.filter((moment) => moment.pinned);
  const pinnedGalleries = galleries.filter((gallery) => gallery.pinned);
  const nothingPinned =
    pinnedPosts.length === 0 &&
    pinnedMoments.length === 0 &&
    pinnedGalleries.length === 0;

  return (
    <div className="flex flex-col gap-9">
      <StatsStrip stats={stats} />

      {pinnedPosts.length > 0 ? (
        <Section title={m.home_pinned_section_posts()} to="/posts">
          {pinnedPosts.map((post) => (
            <PinnedPostCard key={post.id} post={post} />
          ))}
        </Section>
      ) : null}

      {pinnedMoments.length > 0 ? (
        <Section title={m.home_pinned_section_moments()} to="/moments">
          {pinnedMoments.map((moment) => (
            <PinnedMomentCard key={moment.id} moment={moment} />
          ))}
        </Section>
      ) : null}

      {pinnedGalleries.length > 0 ? (
        <Section title={m.home_pinned_section_galleries()} to="/gallery">
          <div className="fuwari-card-base grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
            {pinnedGalleries.map((gallery) => (
              <PinnedGalleryCard key={gallery.id} gallery={gallery} />
            ))}
          </div>
        </Section>
      ) : null}

      {nothingPinned ? (
        <p className="fuwari-card-base px-6 py-12 text-center text-sm fuwari-text-50">
          {m.home_pinned_empty()}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  to,
  children,
}: {
  title: string;
  to: "/posts" | "/moments" | "/gallery";
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-bold fuwari-text-90">
          <span className="h-4 w-1 rounded-md bg-(--fuwari-primary)" />
          {title}
        </h2>
        <Link
          to={to}
          className="flex items-center gap-0.5 text-sm text-(--fuwari-primary) hover:underline"
        >
          {m.home_section_all()}
          <ChevronRight size={14} />
        </Link>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function PinnedPostCard({ post }: { post: PostItem }) {
  const tagNames = (post.tags ?? []).map((tag) => tag.name);

  return (
    <Link
      to="/post/$slug"
      params={{ slug: post.slug }}
      className="fuwari-card-base group flex items-stretch gap-5 p-5 transition-transform md:p-6"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-xl leading-snug font-bold fuwari-text-90 transition-colors group-hover:text-(--fuwari-primary) md:text-2xl">
          {post.privacyProtected ? m.post_private_placeholder() : post.title}
        </h3>

        {post.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed fuwari-text-50">
            {post.summary}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs fuwari-text-50">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} />
            {formatPublicPostDate(post.publishedAt)}
          </span>
          {post.category ? (
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={13} strokeWidth={1.6} />
              {post.category.name}
            </span>
          ) : null}
          {tagNames.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Tag size={13} strokeWidth={1.6} />
              {tagNames.join(" / ")}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} />
            {m.read_time({ count: post.readTimeInMinutes })}
          </span>
        </div>
      </div>

      {post.cover ? (
        <img
          src={getPublicImageSrc(post.cover.url, PUBLIC_IMAGE_WIDTH.cover)}
          alt=""
          className="hidden h-32 w-48 shrink-0 rounded-xl object-cover sm:block"
        />
      ) : null}
    </Link>
  );
}

function PinnedMomentCard({ moment }: { moment: MomentCard }) {
  return (
    <Link
      to="/moments"
      hash={`moment-${moment.id}`}
      className="fuwari-card-base group block p-5 md:p-6"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs fuwari-text-50">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={13} />
          {formatPublicPostDate(moment.publishedAt)}
        </span>
        {moment.locked ? <Lock size={13} className="fuwari-text-30" /> : null}
      </div>

      <p className="line-clamp-4 text-[1.05rem] leading-relaxed whitespace-pre-wrap fuwari-text-90">
        {moment.locked ? m.moments_locked() : moment.body}
      </p>

      {moment.images.length > 0 ? (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {moment.images.slice(0, 4).map((image) => (
            <img
              key={image.url}
              src={image.url}
              alt=""
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              loading="lazy"
              className="aspect-square w-full rounded-xl object-cover"
            />
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function PinnedGalleryCard({ gallery }: { gallery: GalleryCategoryCard }) {
  const concealed = gallery.name.length === 0;

  return (
    <Link
      to="/gallery/$category"
      params={{ category: gallery.slug }}
      className="group block"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-(--fuwari-btn-regular-bg)">
        {gallery.cover ? (
          <img
            src={getPublicImageSrc(gallery.cover.url, PUBLIC_IMAGE_WIDTH.cover)}
            alt=""
            width={gallery.cover.width ?? undefined}
            height={gallery.cover.height ?? undefined}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Images size={30} className="fuwari-text-30" />
          </div>
        )}
      </div>

      <div className="min-w-0 pt-2.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {gallery.locked ? (
            <Lock size={13} className="shrink-0 fuwari-text-50" />
          ) : null}
          <span className="truncate fuwari-text-90 transition-colors group-hover:text-(--fuwari-primary)">
            {concealed ? m.post_private_placeholder() : gallery.name}
          </span>
        </div>
        {concealed ? null : (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs fuwari-text-50">
            <span>{m.gallery_photo_count({ count: gallery.photoCount })}</span>
            {gallery.createdAt ? (
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {formatPublicPostDate(gallery.createdAt)}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </Link>
  );
}

function StatsStrip({ stats }: { stats: SiteStats }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-(--fuwari-radius-large) bg-(--fuwari-card-bg) fuwari-onload-animation sm:grid-cols-4 [&>*]:border-(--fuwari-input-border) [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+2)]:border-l sm:[&>*:nth-child(n+3)]:border-t-0">
      <StatCell
        label={m.home_stat_posts()}
        value={stats.posts}
        detail={
          stats.latestPostAt
            ? m.home_stat_latest_post({
                date: formatPublicPostDate(stats.latestPostAt, {
                  monthDay: true,
                }),
              })
            : m.home_stat_no_posts()
        }
        to="/posts"
      />
      <StatCell
        label={m.home_stat_moments()}
        value={stats.moments}
        detail={
          stats.latestMomentAt
            ? m.home_stat_latest_moment({
                date: formatPublicPostDate(stats.latestMomentAt, {
                  monthDay: true,
                }),
              })
            : m.home_stat_no_moments()
        }
        to="/moments"
      />
      <StatCell
        label={m.home_stat_galleries()}
        value={stats.galleries}
        detail={
          stats.photos > 0
            ? m.gallery_photo_count({ count: stats.photos })
            : m.home_stat_no_photos()
        }
        to="/gallery"
      />
      <StatCell
        label={m.home_stat_friend_links()}
        value={stats.friendLinks}
        detail={
          stats.latestFriendLinkAt
            ? m.home_stat_latest_friend_link({
                date: formatPublicPostDate(stats.latestFriendLinkAt, {
                  monthDay: true,
                }),
              })
            : m.home_stat_no_friend_links()
        }
        to="/friend-links"
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  detail,
  to,
}: {
  label: string;
  value: number;
  detail: string;
  to: "/posts" | "/moments" | "/gallery" | "/friend-links";
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col bg-(--fuwari-card-bg) px-5 py-5 transition-colors hover:bg-(--fuwari-btn-regular-bg) md:px-6 md:py-6"
    >
      <span className="text-xs font-medium fuwari-text-75">{label}</span>
      <span className="mt-1.5 text-3xl leading-none font-semibold tabular-nums fuwari-text-90 transition-colors group-hover:text-(--fuwari-primary) md:text-4xl">
        {value}
      </span>
      <span className="mt-2 truncate text-xs fuwari-text-50">{detail}</span>
    </Link>
  );
}
