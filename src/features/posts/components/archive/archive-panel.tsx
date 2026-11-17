import type { PostItem } from "@/features/posts/schema/posts.schema";
import { siteYear } from "@/lib/site-time";
import { ArchivePost } from "./archive-post";
import { ArchiveYear } from "./archive-year";

interface ArchivePanelProps {
  posts: Array<PostItem>;
}

export function ArchivePanel({ posts }: ArchivePanelProps) {
  // 私密文章不带时间，落不进任何年份；单独排在末尾，不显示年份。
  const lockedPosts = posts.filter(
    (post) => post.locked ?? post.visibility === "password",
  );
  const groupedPosts = posts.reduce(
    (acc, post) => {
      if (!post.publishedAt) {
        return acc;
      }
      if (post.locked ?? post.visibility === "password") {
        return acc;
      }

      const year = siteYear(post.publishedAt);
      acc[year] ??= [];
      acc[year].push(post);
      return acc;
    },
    {} as Record<number, Array<PostItem>>,
  );

  const years = Object.keys(groupedPosts)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="fuwari-card-base px-8 py-6">
      {years.map((year) => (
        <div key={year}>
          <ArchiveYear year={year} count={groupedPosts[year].length} />
          {groupedPosts[year].map((post) => (
            <ArchivePost key={post.id} post={post} />
          ))}
        </div>
      ))}
      {lockedPosts.length > 0 && (
        <div className="mt-2 border-t border-dashed border-(--fuwari-meta-divider) pt-2">
          {lockedPosts.map((post) => (
            <ArchivePost key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
