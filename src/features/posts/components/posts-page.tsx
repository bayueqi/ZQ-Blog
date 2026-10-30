import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import type { TagWithCount } from "@/features/tags/tags.schema";
import { m } from "@/paraglide/messages";
import { ArchivePanel } from "./archive/archive-panel";

export const POSTS_PER_PAGE = 24;

interface PostsPageProps {
  posts: Array<PostItem>;
  tags: Array<Omit<TagWithCount, "createdAt">>;
  selectedTag?: string;
  onTagClick: (tag?: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function PostsPage({
  posts,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: PostsPageProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "0px" },
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      className="fuwari-onload-animation flex flex-col gap-4"
      style={{ animationDelay: "var(--fuwari-content-delay)" }}
    >
      {posts.length > 0 && <ArchivePanel posts={posts} />}

      {/* Infinite Scroll trigger and loading indicator */}
      <div
        ref={observerRef}
        className="flex flex-col items-center justify-center pt-2 pb-8"
      >
        {isFetchingNextPage ? (
          <div className="fuwari-card-base w-full px-8 py-6 opacity-70">
            {/* Inline Mini Skeleton for appending items */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex w-full flex-row justify-start items-stretch px-2 py-3 md:px-3"
              >
                <div className="w-[15%] shrink-0 flex justify-end pr-2 pt-1 md:w-[10%]">
                  <Skeleton className="h-4 w-10" />
                </div>
                <div className="w-[15%] shrink-0 relative fuwari-timeline-dash flex items-start justify-center pt-2.5 md:w-[10%]">
                  <div className="w-2 h-2 rounded-full bg-black/20 dark:bg-white/20 z-10" />
                </div>
                <div className="min-w-0 flex-1 space-y-2 pl-2 pr-2">
                  <Skeleton className="h-5 w-3/4 max-w-50" />
                  <Skeleton className="h-3.5 w-1/2 max-w-40" />
                  <Skeleton className="h-3.5 w-full max-w-80" />
                </div>
              </div>
            ))}
          </div>
        ) : hasNextPage ? (
          <div className="h-px w-24 bg-black/10 dark:bg-white/10"></div>
        ) : posts.length > 0 ? (
          <div className="flex items-center gap-4 text-black/20 dark:text-white/20 mt-4">
            <span className="h-px w-12 bg-current" />
            <span className="text-sm font-bold italic">{m.posts_end()}</span>
            <span className="h-px w-12 bg-current" />
          </div>
        ) : (
          <div className="fuwari-card-base w-full px-6 py-6">
            <header className="mb-6 space-y-1">
              <h1 className="text-2xl font-semibold fuwari-text-90">
                {m.nav_posts()}
              </h1>
            </header>
            <EmptyState description={m.posts_no_posts()} />
          </div>
        )}
      </div>
    </div>
  );
}
