import { useQuery } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { useEffect, type Ref } from "react";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/search-field";
import { Tabs } from "@/components/ui/tabs";
import { categoryOptionsQuery } from "@/features/categories/queries";
import type { AdminPostStatusCounts } from "@/features/posts/schema/posts.schema";
import { tagsAdminQueryOptions } from "@/features/tags/queries";
import { m } from "@/paraglide/messages";
import type { CategoryFilter, SortField, StatusFilter } from "../types";
import { STATUS_FILTERS } from "../types";

const FILTER_TRIGGER =
  "group fuwari-input inline-flex w-auto max-w-44 items-center gap-2 text-left";

interface PostsToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchRef: Ref<HTMLInputElement>;
  status: StatusFilter;
  statusCounts?: AdminPostStatusCounts;
  onStatusChange: (status: StatusFilter) => void;
  category?: CategoryFilter;
  /** `replace` drops a stale filter without adding a history entry. */
  onCategoryChange: (category?: CategoryFilter, replace?: boolean) => void;
  tag?: number;
  onTagChange: (tag?: number, replace?: boolean) => void;
  sortBy: SortField;
  onSortByChange: (sortBy: SortField) => void;
  /** Opens the categories and tags sheet. */
  onManageTaxonomy?: () => void;
}

export function PostsToolbar({
  searchTerm,
  onSearchChange,
  searchRef,
  status,
  statusCounts,
  onStatusChange,
  category,
  onCategoryChange,
  tag,
  onTagChange,
  sortBy,
  onSortByChange,
  onManageTaxonomy,
}: PostsToolbarProps) {
  const categoriesQuery = useQuery({
    ...categoryOptionsQuery,
    refetchOnMount: "always",
  });
  const tagsQuery = useQuery({
    ...tagsAdminQueryOptions(),
    refetchOnMount: "always",
  });
  const categories = categoriesQuery.data ?? [];
  const tags = tagsQuery.data ?? [];
  // A filter left in the URL after its category or tag was deleted.
  const staleCategory =
    typeof category === "number" &&
    categoriesQuery.isSuccess &&
    !categoriesQuery.isFetching &&
    !categories.some((item) => item.id === category);
  const staleTag =
    tag !== undefined &&
    tagsQuery.isSuccess &&
    !tagsQuery.isFetching &&
    !tags.some((item) => item.id === tag);
  useEffect(() => {
    if (staleCategory) onCategoryChange(undefined, true);
    else if (staleTag) onTagChange(undefined, true);
  }, [staleCategory, staleTag, onCategoryChange, onTagChange]);
  const labels: Record<StatusFilter, string> = {
    ALL: m.admin_posts_filter_all(),
    PUBLISHED: m.admin_posts_filter_published(),
    DRAFT: m.admin_posts_filter_draft(),
  };
  const counts = statusCounts
    ? {
        ALL: statusCounts.draft + statusCounts.published,
        PUBLISHED: statusCounts.published,
        DRAFT: statusCounts.draft,
      }
    : undefined;
  return (
    <>
      <Tabs
        className="post-list-tabs"
        aria-label={m.admin_posts_filter_status()}
        value={status}
        onValueChange={onStatusChange}
        items={STATUS_FILTERS.map((value) => ({
          value,
          label: labels[value],
          count: counts?.[value] ?? "—",
        }))}
      />
      <div className="post-list-controls">
        <div className="post-list-filters">
          <SearchField
            ref={searchRef}
            className="post-list-search"
            aria-label={m.admin_posts_search_placeholder()}
            placeholder={m.admin_posts_search_placeholder()}
            value={searchTerm}
            onValueChange={onSearchChange}
            clearLabel={m.admin_posts_clear_search()}
          />
          <DropdownMenu
            value={category === undefined ? "" : String(category)}
            ariaLabel={m.admin_posts_filter_category()}
            triggerClassName={FILTER_TRIGGER}
            placement="bottom-start"
            onChange={(value) =>
              onCategoryChange(
                value === "" ? undefined : value === "none" ? value : +value,
              )
            }
            options={[
              { value: "", label: m.admin_posts_filter_category_all() },
              { value: "none", label: m.post_uncategorized() },
              ...categories.map((item) => ({
                value: String(item.id),
                label: item.name,
              })),
            ]}
          />
          <DropdownMenu
            value={tag === undefined ? "" : String(tag)}
            ariaLabel={m.admin_posts_filter_tag()}
            triggerClassName={FILTER_TRIGGER}
            placement="bottom-start"
            onChange={(value) => onTagChange(value === "" ? undefined : +value)}
            options={[
              { value: "", label: m.admin_posts_filter_tag_all() },
              ...tags.map((item) => ({
                value: String(item.id),
                label: item.name,
              })),
            ]}
          />
          {onManageTaxonomy ? (
            <IconButton
              size="lg"
              label={m.admin_posts_manage_taxonomy()}
              aria-haspopup="dialog"
              onClick={onManageTaxonomy}
            >
              <Settings2 size={18} />
            </IconButton>
          ) : null}
        </div>
        <div className="post-list-sort">
          <span>{m.admin_posts_sort_label()}</span>
          <DropdownMenu
            value={sortBy}
            ariaLabel={m.admin_posts_sort_label()}
            onChange={(value) => onSortByChange(value as SortField)}
            options={[
              { value: "updatedAt", label: m.admin_posts_sort_recent_upd() },
              { value: "publishedAt", label: m.admin_posts_sort_recent_pub() },
            ]}
          />
        </div>
      </div>
    </>
  );
}
