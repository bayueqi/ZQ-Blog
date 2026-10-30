import type { JSONContent } from "@tiptap/react";

export async function calculatePostHash(post: {
  title: string;
  contentJson: JSONContent | null;
  summary: string | null;
  tagIds: Array<number>;
  slug: string;
  publishedAt: Date | string | null;
  pinnedAt?: Date | string | null;
  coverMediaId?: number | null;
  categoryId?: number | null;
  visibility?: string;
  accessPasswordHash?: string | null;
  privacyProtected?: boolean;
}): Promise<string> {
  const toISOOrNull = (d: Date | string | null) =>
    d instanceof Date ? d.toISOString() : d;

  const stateToHash = {
    title: post.title,
    contentJson: post.contentJson,
    summary: post.summary,
    // String order, not numeric: stored revision hashes were computed with
    // the default sort, and must keep matching.
    tagIds: post.tagIds.map(String).sort().map(Number),
    slug: post.slug,
    publishedAt: toISOOrNull(post.publishedAt),
    pinnedAt: toISOOrNull(post.pinnedAt ?? null),
    coverMediaId: post.coverMediaId ?? null,
    categoryId: post.categoryId ?? null,
    // 只有传了才进哈希，老调用方的哈希值保持不变。
    ...(post.visibility === undefined ? {} : { visibility: post.visibility }),
    ...(post.accessPasswordHash === undefined
      ? {}
      : { accessPasswordHash: post.accessPasswordHash }),
    ...(post.privacyProtected === undefined
      ? {}
      : { privacyProtected: post.privacyProtected }),
  };

  const msgUint8 = new TextEncoder().encode(JSON.stringify(stateToHash));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
