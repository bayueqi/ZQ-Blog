import type { PostItem } from "@/features/posts/schema/posts.schema";
import { HomePagination } from "./home-pagination";
import { PostCard } from "./post-card";

interface HomePageProps {
  posts: Array<PostItem>;
  page: number;
  totalPages: number;
}

export function HomePage({ posts, page, totalPages }: HomePageProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col rounded-(--fuwari-radius-large) bg-(--fuwari-card-bg) py-1 md:py-0 md:bg-transparent md:gap-4">
        {posts.map((post, i) => (
          <div
            key={post.slug}
            className="fuwari-onload-animation"
            style={{
              animationDelay: `calc(var(--fuwari-content-delay) + ${i * 50}ms)`,
            }}
          >
            <PostCard post={post} pinned={Boolean(post.pinnedAt)} />
            {i < posts.length - 1 && (
              <div className="border-t border-dashed mx-6 border-black/10 dark:border-white/15 md:hidden" />
            )}
          </div>
        ))}
      </div>
      <HomePagination page={page} totalPages={totalPages} />
    </div>
  );
}
