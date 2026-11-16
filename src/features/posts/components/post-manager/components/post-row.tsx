import { ClientOnly, Link } from "@tanstack/react-router";
import { EyeOff, Lock, Pencil, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { iconButtonClass, IconButton } from "@/components/ui/icon-button";
import { PostStatusBadge } from "@/features/posts/components/post-status-badge";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { AdminPostListItem } from "../types";

interface PostRowProps {
  post: AdminPostListItem;
  onDelete: (
    post: AdminPostListItem,
    trigger: HTMLButtonElement | null,
  ) => void;
  onTogglePin?: (post: AdminPostListItem) => void;
  pinPending?: boolean;
  onPublish?: (post: AdminPostListItem) => void;
  onUnpublish?: (
    post: AdminPostListItem,
    trigger: HTMLButtonElement | null,
  ) => void;
  publishPending?: boolean;
}

export function PostRow({
  post,
  onDelete,
  onTogglePin,
  pinPending,
  onPublish,
  onUnpublish,
  publishPending,
}: PostRowProps) {
  const title = post.title.trim() || m.common_untitled();
  const published = post.status === "published";
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
            <span className="post-list-title-line">
              <strong>{title}</strong>
              {post.visibility === "password" && (
                <Lock
                  size={12}
                  strokeWidth={2}
                  className="post-list-lock"
                  aria-label={m.gallery_locked_badge()}
                />
              )}
            </span>
            <span className="post-list-slug">
              {post.slug || m.admin_posts_slug_empty()}
            </span>
          </Link>
        </div>
      </td>
      <td>
        <PostStatusBadge
          published={published}
          scheduled={
            published &&
            post.publishedAt != null &&
            post.publishedAt.getTime() > Date.now()
          }
        />
      </td>
      <td className="post-list-date">
        <span className="post-list-mobile-date-label">
          {m.admin_posts_time_published()}{" "}
        </span>
        {post.publishedAt ? (
          <time dateTime={post.publishedAt.toISOString()}>
            <ClientOnly fallback="—">{formatDate(post.publishedAt)}</ClientOnly>
          </time>
        ) : (
          "—"
        )}
      </td>
      <td className="post-list-date">
        {post.updatedAt ? (
          <time dateTime={post.updatedAt.toISOString()}>
            <ClientOnly fallback="—">{formatDate(post.updatedAt)}</ClientOnly>
          </time>
        ) : (
          "—"
        )}
      </td>
      <td>
        <div className="flex items-center gap-0.5">
          {onTogglePin ? (
            <IconButton
              size="sm"
              label={
                post.pinnedAt
                  ? m.admin_posts_action_unpin()
                  : m.admin_posts_action_pin()
              }
              disabled={pinPending}
              onClick={() => onTogglePin(post)}
            >
              {post.pinnedAt ? (
                <PinOff size={15} strokeWidth={2} />
              ) : (
                <Pin size={15} strokeWidth={2} />
              )}
            </IconButton>
          ) : null}
          <Link
            to="/admin/posts/edit/$id"
            params={{ id: String(post.id) }}
            aria-label={m.admin_posts_edit_named({ title })}
            title={m.admin_posts_action_edit()}
            className={iconButtonClass({ size: "sm" })}
          >
            <Pencil size={15} strokeWidth={2} />
          </Link>
          {published ? (
            onUnpublish ? (
              <IconButton
                size="sm"
                label={m.editor_header_unpublish()}
                disabled={publishPending}
                onClick={(event) => onUnpublish(post, event.currentTarget)}
              >
                <EyeOff size={15} strokeWidth={2} />
              </IconButton>
            ) : null
          ) : onPublish ? (
            <IconButton
              size="sm"
              label={m.editor_header_publish()}
              disabled={publishPending}
              onClick={() => onPublish(post)}
            >
              <Send size={15} strokeWidth={2} />
            </IconButton>
          ) : null}
          <IconButton
            size="sm"
            tone="danger"
            label={m.admin_posts_action_delete_post()}
            onClick={(event) => onDelete(post, event.currentTarget)}
          >
            <Trash2 size={15} strokeWidth={2} />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}
