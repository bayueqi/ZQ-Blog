import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import { ClientOnly, Link } from "@tanstack/react-router";
import { ExternalLink, EyeOff, Pin, PinOff, Trash2 } from "lucide-react";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { PostStatusBadge } from "@/features/posts/components/post-status-badge";
import { openPublicPost } from "@/features/posts/utils/open-public-post";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { AdminPostListItem, SortField } from "../types";

interface PostRowProps {
  post: AdminPostListItem;
  sortBy: SortField;
  onDelete: (
    post: AdminPostListItem,
    trigger: HTMLButtonElement | null,
  ) => void;
  onTogglePin?: (post: AdminPostListItem) => void;
  pinPending?: boolean;
  onUnpublish?: (post: AdminPostListItem, trigger: HTMLButtonElement) => void;
}

export function PostRow({
  post,
  sortBy,
  onDelete,
  onTogglePin,
  pinPending,
  onUnpublish,
}: PostRowProps) {
  const title = post.title.trim() || m.common_untitled();
  const date = post[sortBy];
  const published = post.status === "published";
  const { publicSlug } = post;
  const actions: Array<ActionMenuItem> = [];
  if (published && publicSlug)
    actions.push({
      label: m.admin_posts_action_view_live(),
      icon: ExternalLink,
      onSelect: () => openPublicPost(publicSlug),
    });
  if (onTogglePin)
    actions.push({
      label: post.pinnedAt
        ? m.admin_posts_action_unpin()
        : m.admin_posts_action_pin(),
      icon: post.pinnedAt ? PinOff : Pin,
      disabled: pinPending,
      onSelect: () => onTogglePin(post),
    });
  if (published && onUnpublish)
    actions.push({
      label: m.editor_header_unpublish(),
      icon: EyeOff,
      danger: true,
      onSelect: (trigger) => onUnpublish(post, trigger),
    });
  actions.push({
    label: m.admin_posts_action_delete_post(),
    icon: Trash2,
    danger: true,
    separator: actions.length > 0,
    onSelect: (trigger) => onDelete(post, trigger),
  });
  return (
    <tr>
      <td>
        <div className="post-list-title-cell">
          <span className="post-list-pin">
            {post.pinnedAt && (
              <Pin size={18} aria-label={m.admin_posts_pinned()} />
            )}
          </span>
          <Link
            to="/admin/posts/edit/$id"
            params={{ id: String(post.id) }}
            className="post-list-title-link"
          >
            <strong>{title}</strong>
            <span>{post.slug || m.admin_posts_slug_empty()}</span>
          </Link>
        </div>
      </td>
      <td>
        <PostStatusBadge published={post.status === "published"} />
      </td>
      <td className="post-list-date">
        <span className="post-list-mobile-date-label">
          {sortBy === "publishedAt"
            ? m.admin_posts_time_published()
            : m.admin_posts_time_modified()}{" "}
        </span>
        {date ? (
          <time dateTime={date.toISOString()}>
            {sortBy === "publishedAt" ? (
              formatPublicPostDate(date)
            ) : (
              <ClientOnly fallback="—">{formatDate(date)}</ClientOnly>
            )}
          </time>
        ) : (
          "—"
        )}
      </td>
      <td>
        <div className="post-list-row-actions">
          <Link
            to="/admin/posts/edit/$id"
            params={{ id: String(post.id) }}
            aria-label={m.admin_posts_edit_named({ title })}
          >
            {m.admin_posts_action_edit()}
          </Link>
          <ActionMenu
            label={m.admin_posts_more_named({ title })}
            items={actions}
          />
        </div>
      </td>
    </tr>
  );
}
