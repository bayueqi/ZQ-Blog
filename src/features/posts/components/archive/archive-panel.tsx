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

  function groupByYear(list: Array<PostItem>) {
    const grouped = list.reduce((acc, post) => {
      if (!post.publishedAt) return acc;
      const year = siteYear(post.publishedAt);
      acc[year] ??= [];
      acc[year].push(post);
      return acc;
    }, {} as Record<number, Array<PostItem>>);
    const years = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => b - a);
    return { grouped, years };
  }

  // 三段式：置顶在上，普通居中，私密在下；置顶和普通都按年份标题展示。
  const pinned = groupByYear(
    posts.filter((post) => !isLocked(post) && post.pinnedAt),
  );
  const normal = groupByYear(
    posts.filter((post) => !isLocked(post) && !post.pinnedAt),
  );
  const lockedPosts = posts.filter(isLocked);

  const renderYears = (
    years: Array<number>,
    grouped: Record<number, Array<PostItem>>,
  ) =>
    years.map((year) => (
      <div key={year}>
        <ArchiveYear year={year} count={grouped[year].length} />
        {grouped[year].map((post) => (
          <ArchivePost key={post.id} post={post} />
        ))}
      </div>
    ));

  const sections: Array<{ key: string; node: ReactNode }> = [];
  if (pinned.years.length > 0) {
    sections.push({
      key: "pinned",
      node: renderYears(pinned.years, pinned.grouped),
    });
  }
  if (normal.years.length > 0) {
    sections.push({
      key: "normal",
      node: renderYears(normal.years, normal.grouped),
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
