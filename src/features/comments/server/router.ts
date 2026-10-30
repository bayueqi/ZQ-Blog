import {
  CommentCountsResponseSchema,
  CommentHandledInputSchema,
  CommentSelectSchema,
  CommentsHandledCountSchema,
  CreateCommentInputSchema,
  DeleteCommentInputSchema,
  GetCommentCountsInputSchema,
  GetCommentsInputSchema,
  GetMyCommentsInputSchema,
  GetRepliesInputSchema,
  GetRepliesResponseSchema,
  GetRootCommentsResponseSchema,
  GetThreadByCommentIdInputSchema,
  RootCommentWithReplyCountSchema,
} from "@/features/comments/comments.schema";
import { z } from "zod";
import * as CommentService from "@/features/comments/comments.service";
import {
  AdminCommentsInputSchema,
  AdminCommentsPageSchema,
} from "@/features/dashboard/dashboard.schema";
import * as DashboardService from "@/features/dashboard/service/dashboard.service";
import {
  adminProcedure,
  authProcedure,
  optionalSessionProcedure,
  turnstileMiddleware,
  withRateLimit,
} from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const commentErrors = {
  ROOT_COMMENT_NOT_FOUND: { status: 404, message: "Root comment not found." },
  INVALID_ROOT_ID: { status: 400, message: "Invalid root comment." },
  ROOT_COMMENT_TARGET_MISMATCH: {
    status: 400,
    message: "Root comment does not belong to this content.",
  },
  REPLY_TO_COMMENT_NOT_FOUND: {
    status: 404,
    message: "Reply target not found.",
  },
  REPLY_TO_COMMENT_ROOT_MISMATCH: {
    status: 400,
    message: "Reply target is not in this thread.",
  },
  ROOT_COMMENT_CANNOT_HAVE_REPLY_TO: {
    status: 400,
    message: "A root comment cannot reply to another comment.",
  },
  COMMENT_NOT_FOUND: { status: 404, message: "Comment not found." },
  TARGET_NOT_OPEN: {
    status: 404,
    message: "This content is not open for comments.",
  },
  USER_MUTED: {
    status: 403,
    message: "Muted users cannot create comments.",
  },
} as const;

const roots = optionalSessionProcedure
  .route({
    method: "GET",
    path: "/comments",
    summary: "List root comments on a post, moment or gallery category",
    description:
      "Returns visible root threads with reply previews. Offset and limit paginate root threads, including deleted roots that still have published replies. Total counts all published roots and replies on the target, excluding deleted placeholders; it must not be used to calculate root pagination.",
    tags: ["Comments"],
  })
  .input(GetCommentsInputSchema)
  .output(GetRootCommentsResponseSchema)
  .handler(({ context, input }) =>
    CommentService.getRootComments(context, input),
  );

const counts = optionalSessionProcedure
  .route({
    method: "GET",
    path: "/comments/counts",
    summary: "Count published comments for several targets at once",
    description:
      "Used by lists that show a comment count per item, such as the Moments feed.",
    tags: ["Comments"],
  })
  .input(GetCommentCountsInputSchema)
  .output(CommentCountsResponseSchema)
  .handler(({ context, input }) =>
    CommentService.getCommentCounts(context, input),
  );

const replies = optionalSessionProcedure
  .route({
    method: "GET",
    path: "/comments/replies",
    summary: "List replies in a comment thread",
    tags: ["Comments"],
  })
  .input(GetRepliesInputSchema)
  .output(GetRepliesResponseSchema)
  .handler(({ context, input }) =>
    CommentService.getRepliesByRootId(context, input),
  );

const thread = optionalSessionProcedure
  .errors({ COMMENT_NOT_FOUND: commentErrors.COMMENT_NOT_FOUND })
  .route({
    method: "GET",
    path: "/comments/thread",
    summary: "Load the visible comment thread containing a comment",
    tags: ["Comments"],
  })
  .input(GetThreadByCommentIdInputSchema)
  .output(RootCommentWithReplyCountSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.getThreadByCommentId(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
    }),
  );

const create = authProcedure
  .use(withRateLimit({ capacity: 10, interval: "1m", key: "comments:create" }))
  .use(turnstileMiddleware)
  .errors(commentErrors)
  .route({
    method: "POST",
    path: "/comments",
    summary: "Create a comment",
    tags: ["Comments"],
  })
  .input(CreateCommentInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.createComment(context, input), {
      ROOT_COMMENT_NOT_FOUND: () => {
        throw errors.ROOT_COMMENT_NOT_FOUND();
      },
      INVALID_ROOT_ID: () => {
        throw errors.INVALID_ROOT_ID();
      },
      ROOT_COMMENT_TARGET_MISMATCH: () => {
        throw errors.ROOT_COMMENT_TARGET_MISMATCH();
      },
      REPLY_TO_COMMENT_NOT_FOUND: () => {
        throw errors.REPLY_TO_COMMENT_NOT_FOUND();
      },
      REPLY_TO_COMMENT_ROOT_MISMATCH: () => {
        throw errors.REPLY_TO_COMMENT_ROOT_MISMATCH();
      },
      ROOT_COMMENT_CANNOT_HAVE_REPLY_TO: () => {
        throw errors.ROOT_COMMENT_CANNOT_HAVE_REPLY_TO();
      },
      TARGET_NOT_OPEN: () => {
        throw errors.TARGET_NOT_OPEN();
      },
      USER_MUTED: () => {
        throw errors.USER_MUTED();
      },
    }),
  );

const remove = authProcedure
  .use(withRateLimit({ capacity: 10, interval: "1m", key: "comments:delete" }))
  .errors(commentErrors)
  .route({
    method: "DELETE",
    path: "/comments/{id}",
    summary: "Delete own comment",
    tags: ["Comments"],
  })
  .input(DeleteCommentInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.deleteComment(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
      PERMISSION_DENIED: () => {
        throw errors.FORBIDDEN();
      },
    }),
  );

const mine = authProcedure
  .route({
    method: "GET",
    path: "/me/comments",
    summary: "List the current user's comments",
    tags: ["Comments"],
  })
  .input(GetMyCommentsInputSchema)
  .output(z.array(CommentSelectSchema))
  .handler(({ context, input }) =>
    CommentService.getMyComments(context, input),
  );

const adminList = adminProcedure
  .route({
    method: "GET",
    path: "/admin/comments",
    summary: "List comments for the admin comment page",
    description:
      "Every visitor Comment, newest first, filtered to all, unreplied or replied; also returns each filter's total for the tabs.",
    tags: ["Admin Comments"],
  })
  .input(AdminCommentsInputSchema)
  .output(AdminCommentsPageSchema)
  .handler(({ context, input }) =>
    DashboardService.listAdminComments(context, input),
  );

const markHandled = adminProcedure
  .errors({ COMMENT_NOT_FOUND: commentErrors.COMMENT_NOT_FOUND })
  .route({
    method: "PUT",
    path: "/admin/comments/{id}/handled",
    summary: "Mark a comment handled",
    description:
      "Takes the Comment off the dashboard's unreplied list without replying. An Admin reply marks the Comment it answers handled too.",
    tags: ["Admin Comments"],
  })
  .input(CommentHandledInputSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.markCommentHandled(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
    }),
  );

const unmarkHandled = adminProcedure
  .errors({ COMMENT_NOT_FOUND: commentErrors.COMMENT_NOT_FOUND })
  .route({
    method: "DELETE",
    path: "/admin/comments/{id}/handled",
    summary: "Unmark a handled comment",
    description:
      "Undoes marking the Comment handled. It returns to the unreplied list unless an Admin Comment still answers it.",
    tags: ["Admin Comments"],
  })
  .input(CommentHandledInputSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.unmarkCommentHandled(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
    }),
  );

const markAllHandled = adminProcedure
  .route({
    method: "POST",
    path: "/admin/comments/handled",
    summary: "Mark all unreplied comments handled",
    description:
      "Marks every Comment on the dashboard's unreplied list handled and returns how many it marked.",
    tags: ["Admin Comments"],
  })
  .output(CommentsHandledCountSchema)
  .handler(({ context }) =>
    CommentService.markAllUnrepliedCommentsHandled(context),
  );

export default {
  roots,
  counts,
  replies,
  thread,
  create,
  remove,
  mine,
  admin: {
    list: adminList,
    markHandled,
    unmarkHandled,
    markAllHandled,
  },
};
