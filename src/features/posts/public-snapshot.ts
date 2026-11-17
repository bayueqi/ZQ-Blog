import type { Tag } from "@/lib/db/schema";
import type {
  PublicPostCover,
  PublicPostSnapshot,
} from "@/lib/db/schema/posts.table";
import { estimateReadTimeMinutes } from "@/features/posts/utils/content";
import type { PostItem } from "@/features/posts/schema/posts.schema";

export function toPublicCover(
  cover: PublicPostCover | null | undefined,
): PostItem["cover"] {
  if (!cover) return null;
  return {
    key: cover.key,
    url: cover.url,
    width: cover.width,
    height: cover.height,
  };
}

export function toIsoOrNull(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function mapSnapshotToPublicPost(
  row: {
    id: number;
    status: "draft" | "published";
    visibility: "public" | "password";
    createdAt: Date;
    updatedAt: Date;
    publicSlug?: string | null;
    publicSnapshotJson: PublicPostSnapshot | null;
  },
  tags: Array<Tag> = [],
  category: { id: number; name: string } | null = null,
  /** 列表里私密内容只留锁卡片，露出的是「私密文章-1」这类占位链接。 */
  concealLocked = true,
): PostItem | null {
  const snapshot = row.publicSnapshotJson;
  if (!snapshot) return null;

  if (concealLocked && row.visibility === "password") {
    const epoch = new Date(0);
    return {
      id: row.id,
      title: "",
      summary: null,
      slug: row.publicSlug ?? "",
      status: "published",
      visibility: row.visibility,
      publishedAt: null,
      pinnedAt: null,
      createdAt: epoch,
      updatedAt: epoch,
      readTimeInMinutes: 1,
      tags: [],
      category: null,
      cover: null,
    };
  }

  return {
    id: row.id,
    title: snapshot.title,
    summary: snapshot.summary,
    slug: snapshot.slug,
    status: "published",
    visibility: row.visibility,
    publishedAt: new Date(snapshot.publishedAt),
    pinnedAt: snapshot.pinnedAt ? new Date(snapshot.pinnedAt) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    readTimeInMinutes: estimateReadTimeMinutes(snapshot.contentJson),
    tags,
    category,
    cover: toPublicCover(snapshot.cover),
  };
}
