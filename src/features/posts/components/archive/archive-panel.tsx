import type { ReactNode } from "react";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import { siteYear } from "@/lib/site-time";
import { ArchivePost } from "./archive-post";
import { ArchiveYear } from "./archive-year";

interface ArchivePanelProps {
  posts: Array<PostItem>;
}

export function ArchivePanel({ posts }: ArchivePanelProps) {
  const isLocked = (post: PostItem) =>
    post.locked ?? post.visibility === "password";
  // 三段式：置顶在上，普通居中（按年份），私密在下。
  const pinnedPosts = posts.filter(
    (post) => !isLocked(post) && post.pinnedAt && post.publishedAt,
  );
  const lockedPosts = posts.filter(isLocked);
  const groupedPosts = posts.reduce(
    (acc, post) => {
      if (!post.publishedAt) {
        return acc;
      }
      if (isLocked(post) || post.pinnedAt) {
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

  const sections: Array<{ key: string; node: ReactNode }> = [];
  if (pinnedPosts.length > 0) {
    sections.push({
      key: "pinned",
      node: pinnedPosts.map((post) => (
        <ArchivePost key={post.id} post={post} />
      )),
    });
  }
  if (years.length > 0) {
    sections.push({
      key: "normal",
      node: years.map((year) => (
        <div key={year}>
          <ArchiveYear year={year} count={groupedPosts[year].length} />
          {groupedPosts[year].map((post) => (
            <ArchivePost key={post.id} post={post} />
          ))}
        </div>
      )),
    });
  }
  if (lockedPosts.length > 0) {
    sections.push({
      key: "locked",
      node: lockedPosts.map((post) => (
        <ArchivePost key={post.id} post={post} />
      )),
    });
  }

  return (
    <div className="fuwari-card-base px-8 py-6">
      {sections.map((section, index) => (
        <div
          key={section.key}
          className={
            index > 0
              ? "mt-5 border-t border-black pt-1 dark:border-white/70"
              : undefined
          }
        >
          {section.node}
        </div>
      ))}
    </div>
  );
}
