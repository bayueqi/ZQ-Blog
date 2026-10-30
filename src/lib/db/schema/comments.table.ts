import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt, id, updatedAt } from "./helper";

export const COMMENT_STATUSES = ["published", "deleted"] as const;

/**
 * What a Comment hangs on. Everything else about a Comment — threads, replies,
 * moderation — works the same whichever kind of content it is.
 */
export const COMMENT_TARGET_TYPES = ["post", "moment", "gallery"] as const;

export const CommentsTable = sqliteTable(
  "comments",
  {
    id,
    content: text(),
    rootId: integer("root_id").references(
      (): AnySQLiteColumn => CommentsTable.id,
      {
        onDelete: "cascade",
      },
    ),
    replyToCommentId: integer("reply_to_comment_id").references(
      (): AnySQLiteColumn => CommentsTable.id,
      { onDelete: "set null" },
    ),
    status: text("status", { enum: COMMENT_STATUSES })
      .notNull()
      .default("published"),

    targetType: text("target_type", { enum: COMMENT_TARGET_TYPES })
      .notNull()
      .default("post"),
    targetId: integer("target_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /**
     * When an Admin dealt with the Comment, by replying or by marking it
     * handled; it then no longer waits for a reply. Admin-only.
     */
    handledAt: integer("handled_at", { mode: "timestamp" }),

    createdAt,
    updatedAt,
  },
  (table) => [
    index("comments_target_root_created_idx").on(
      table.targetType,
      table.targetId,
      table.rootId,
      table.createdAt,
    ),
    index("comments_target_status_idx").on(
      table.targetType,
      table.targetId,
      table.status,
    ),
    index("comments_user_created_idx").on(table.userId, table.createdAt),
    index("comments_status_created_idx").on(table.status, table.createdAt),
    index("comments_global_created_idx").on(table.createdAt),
  ],
);

export const EMAIL_UNSUBSCRIBE_TYPES = ["reply_notification"] as const;

export const EmailUnsubscriptionsTable = sqliteTable(
  "email_unsubscriptions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: EMAIL_UNSUBSCRIBE_TYPES }).notNull(),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
);

// ==================== types ====================
export type Comment = typeof CommentsTable.$inferSelect;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number];
export type EmailUnsubscription = typeof EmailUnsubscriptionsTable.$inferSelect;
export type EmailUnsubscribeType = (typeof EMAIL_UNSUBSCRIBE_TYPES)[number];
