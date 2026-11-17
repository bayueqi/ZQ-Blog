import type { Post } from "@/lib/db/schema";

/** Post fields used by admin list rows. */
export type AdminPostListItem = Omit<
  Post,
  | "contentJson"
  | "publicSnapshotJson"
  | "coverMediaId"
  | "categoryId"
  | "accessPasswordHash"
>;

/** Status filter options for posts list */
export const STATUS_FILTERS = ["ALL", "PUBLISHED", "DRAFT"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Sort fields options */
export const SORT_FIELDS = ["publishedAt", "updatedAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

/** A category id, or "none" for posts without one. */
export type CategoryFilter = number | "none";

/** Convert StatusFilter to API status param */
export function statusFilterToApi(
  filter: StatusFilter,
): "published" | "draft" | undefined {
  if (filter === "ALL") return undefined;
  return filter === "PUBLISHED" ? "published" : "draft";
}
