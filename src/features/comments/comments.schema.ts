import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import type { CommentStatus } from "@/lib/db/schema";
import { COMMENT_TARGET_TYPES, CommentsTable } from "@/lib/db/schema";

// Date fields need to accept both Date objects and ISO strings (for JSON serialization)
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

/** A Comment as public APIs return it; when an Admin handled it stays private. */
export const CommentSelectSchema = createSelectSchema(CommentsTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
}).omit({ handledAt: true });

// User info schema for joined queries
const CommentUserSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  mutedAt: coercedDate.nullable(),
});

const CommentWithUserSchema = CommentSelectSchema.extend({
  user: CommentUserSchema.nullable(),
  target: z
    .object({
      type: z.enum(COMMENT_TARGET_TYPES),
      title: z.string().optional().nullable(),
      path: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
  replyToUser: z
    .object({
      id: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
});

/** What a Comment hangs on: a Post, a Moment or a Gallery Category. */
export const CommentTargetSchema = z.object({
  targetType: z.enum(COMMENT_TARGET_TYPES),
  targetId: z.number().int().positive(),
});

// Public API Schemas
export const GetCommentsInputSchema = CommentTargetSchema.extend({
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export const GetRepliesInputSchema = CommentTargetSchema.extend({
  rootId: z.number(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export const GetCommentCountsInputSchema = CommentTargetSchema.pick({
  targetType: true,
}).extend({
  targetIds: z.array(z.number().int().positive()).max(50),
});

const ReplyWithUserAndReplyToSchema = CommentWithUserSchema.extend({
  replyTo: z
    .object({
      id: z.string().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
});

export const GetRepliesResponseSchema = z.object({
  items: z.array(ReplyWithUserAndReplyToSchema),
  total: z.number(),
});

export const RootCommentWithReplyCountSchema = CommentWithUserSchema.extend({
  replyCount: z.number(),
  replies: z.array(ReplyWithUserAndReplyToSchema),
});

export const GetRootCommentsResponseSchema = z.object({
  items: z.array(RootCommentWithReplyCountSchema),
  total: z
    .number()
    .describe(
      "Total published comments on this target, including roots and replies but excluding deleted placeholders. This is not the number of paginated root threads.",
    ),
  viewerMuted: z.boolean(),
});

export const CommentCountsResponseSchema = z.object({
  counts: z.record(z.string(), z.number()),
});

// Authed User API Schemas
const CommentBodySchema = z.string().trim().min(1);

export const CreateCommentInputSchema = CommentTargetSchema.extend({
  content: CommentBodySchema,
  rootId: z.number().optional(),
  replyToCommentId: z.number().optional(),
});

export const DeleteCommentInputSchema = z.object({
  id: z.number(),
});

export const GetThreadByCommentIdInputSchema = CommentTargetSchema.extend({
  id: z.number(),
});

export const GetMyCommentsInputSchema = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
  status: z.custom<CommentStatus>().optional(),
});

// Admin API Schemas
export const CommentHandledInputSchema = z.object({
  id: z.number().int().positive(),
});

export const CommentsHandledCountSchema = z.object({
  count: z.number().int().nonnegative(),
});

// Types
export type CommentTarget = z.infer<typeof CommentTargetSchema>;
export type GetCommentsInput = z.infer<typeof GetCommentsInputSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;
export type DeleteCommentInput = z.infer<typeof DeleteCommentInputSchema>;
export type GetMyCommentsInput = z.infer<typeof GetMyCommentsInputSchema>;
export type RootCommentWithReplyCount = z.infer<
  typeof RootCommentWithReplyCountSchema
>;
export type CommentWithUser = z.infer<typeof CommentWithUserSchema>;
