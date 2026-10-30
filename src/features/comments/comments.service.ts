import type {
  CommentTarget,
  CreateCommentInput,
  DeleteCommentInput,
  GetCommentsInput,
  GetMyCommentsInput,
  RootCommentWithReplyCount,
} from "@/features/comments/comments.schema";
import {
  publicCommentPath,
  targetPagePath,
} from "@/features/comments/comment-url";
import * as CommentRepo from "@/features/comments/data/comments.data";
import { sendReplyNotification } from "@/features/comments/workflows/helpers";
import * as DashboardRepo from "@/features/dashboard/data/dashboard.data";
import * as GalleryData from "@/features/gallery/data/gallery.data";
import * as MomentsRepo from "@/features/moments/data/moments.data";
import * as MutedUserRepo from "@/features/muted-users/data/muted-users.data";
import { isMuted } from "@/features/muted-users/muted-users";
import { publishNotificationEvent } from "@/features/notification/service/notification.publisher";
import * as PostService from "@/features/posts/services/posts.service";
import { serverEnv } from "@/lib/env/server.env";
import { err, ok } from "@/lib/errors";
import { m } from "@/paraglide/messages";

/**
 * A Comment lives under one piece of content. `title` feeds the notification
 * and moderation copy; `commentPath` is where a reader lands when they follow
 * that notification. Null when the content is gone or not open to discussion.
 */
interface CommentTargetInfo {
  title: string;
  /** 通知里的完整称呼，如「文章《标题》」。 */
  label: string;
  pagePath: string;
  commentPath: (commentId: number) => string;
}

function momentExcerpt(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

async function requireTarget(
  context: DbContext,
  target: CommentTarget,
): Promise<CommentTargetInfo | null> {
  const { LOCALE } = serverEnv(context.env);

  if (target.targetType === "post") {
    const post = await PostService.findPostById(context, {
      id: target.targetId,
    });
    if (!post || !post.hasPublicSnapshot) {
      return null;
    }
    const ref = { targetType: "post", slug: post.slug } as const;
    return {
      title: post.title,
      label: m.notification_target_post(
        { title: post.title },
        { locale: LOCALE },
      ),
      pagePath: targetPagePath(ref),
      commentPath: (commentId) => publicCommentPath(ref, commentId),
    };
  }

  if (target.targetType === "moment") {
    const moment = await MomentsRepo.findById(context.db, target.targetId);
    // 只有公开且没加密的日常才开放评论：加密日常的正文本来就要密码。
    if (!moment || !moment.publishedAt || moment.accessPasswordHash) {
      return null;
    }
    const title =
      momentExcerpt(moment.body) || m.moments_title({}, { locale: LOCALE });
    const ref = { targetType: "moment", momentId: moment.id } as const;
    return {
      title,
      label: m.notification_target_moment({ title }, { locale: LOCALE }),
      pagePath: targetPagePath(ref),
      // 落到具体那条评论：日常默认收起评论，靠 comment 参数找到它并展开。
      commentPath: (commentId) => publicCommentPath(ref, commentId),
    };
  }

  const category = await GalleryData.findCategoryById(
    context.db,
    target.targetId,
  );
  if (!category || category.privacyProtected || category.accessPasswordHash) {
    return null;
  }
  const ref = { targetType: "gallery", slug: category.slug } as const;
  return {
    title: category.name,
    label: m.notification_target_gallery(
      { title: category.name },
      { locale: LOCALE },
    ),
    pagePath: targetPagePath(ref),
    commentPath: (commentId) => publicCommentPath(ref, commentId),
  };
}

async function viewerMuted(
  context: DbContext & { session?: AuthContext["session"] | null },
) {
  const sessionUser = context.session?.user;
  if (!sessionUser || sessionUser.role === "admin") {
    return false;
  }
  const actor = await MutedUserRepo.findUserById(context.db, sessionUser.id);
  return isMuted(actor?.mutedAt);
}

export async function getRootComments(
  context: DbContext & { session?: AuthContext["session"] | null },
  data: GetCommentsInput,
) {
  const target: CommentTarget = {
    targetType: data.targetType,
    targetId: data.targetId,
  };
  const targetInfo = await requireTarget(context, target);
  if (!targetInfo) {
    return { items: [], total: 0, viewerMuted: false };
  }

  const [items, total, muted] = await Promise.all([
    CommentRepo.getRootCommentsByTarget(context.db, target, {
      offset: data.offset,
      limit: data.limit,
    }),
    CommentRepo.getPublishedCommentsCount(context.db, target),
    viewerMuted(context),
  ]);

  return {
    items: await withReplyCountsAndPreviews(context.db, target, items),
    total,
    viewerMuted: muted,
  };
}

export async function getCommentCounts(
  context: DbContext,
  data: {
    targetType: CommentTarget["targetType"];
    targetIds: Array<number>;
  },
) {
  const counts = await CommentRepo.getPublishedCommentCounts(
    context.db,
    data.targetType,
    data.targetIds,
  );
  return {
    counts: Object.fromEntries(counts) as Record<string, number>,
  };
}

async function withReplyCountsAndPreviews(
  db: DB,
  target: CommentTarget,
  items: Awaited<ReturnType<typeof CommentRepo.getRootCommentsByTarget>>,
): Promise<Array<RootCommentWithReplyCount>> {
  const rootIds = items.map((item) => item.id);
  const [replyCounts, previews] = await Promise.all([
    CommentRepo.getPublishedReplyCountsByRootIds(db, target, rootIds),
    CommentRepo.getReplyPreviewsByRootIds(db, target, rootIds),
  ]);

  return items.map((item) => {
    const replyCount = replyCounts.get(item.id) ?? 0;
    return {
      ...item,
      replyCount,
      replies: replyCount === 0 ? [] : (previews.get(item.id) ?? []),
    };
  });
}

export async function getThreadByCommentId(
  context: DbContext,
  data: {
    targetType: CommentTarget["targetType"];
    targetId: number;
    id: number;
  },
) {
  const target: CommentTarget = {
    targetType: data.targetType,
    targetId: data.targetId,
  };
  const targetInfo = await requireTarget(context, target);
  if (!targetInfo) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }

  const comment = await CommentRepo.findCommentById(context.db, data.id);
  if (!comment || !sameTarget(comment, target)) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }

  const rootId = comment.rootId ?? comment.id;
  const root = await CommentRepo.getVisibleRootById(context.db, target, rootId);
  if (!root) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }

  const [thread] = await withReplyCountsAndPreviews(context.db, target, [root]);
  return ok(thread);
}

function sameTarget(
  comment: { targetType: string; targetId: number },
  target: CommentTarget,
) {
  return (
    comment.targetType === target.targetType &&
    comment.targetId === target.targetId
  );
}

export async function getRepliesByRootId(
  context: DbContext,
  data: {
    targetType: CommentTarget["targetType"];
    targetId: number;
    rootId: number;
    offset?: number;
    limit?: number;
  },
) {
  const target: CommentTarget = {
    targetType: data.targetType,
    targetId: data.targetId,
  };
  const targetInfo = await requireTarget(context, target);
  if (!targetInfo) {
    return { items: [], total: 0 };
  }

  const root = await CommentRepo.findCommentById(context.db, data.rootId);
  if (!root || !sameTarget(root, target)) {
    return { items: [], total: 0 };
  }

  const total = await CommentRepo.getReplyCountByRootId(
    context.db,
    target,
    data.rootId,
    { status: "published" },
  );
  if (root.status === "deleted" && total === 0) {
    return { items: [], total: 0 };
  }

  const items = await CommentRepo.getRepliesByRootId(
    context.db,
    target,
    data.rootId,
    {
      offset: data.offset,
      limit: data.limit,
    },
  );

  return { items, total };
}

export async function createComment(
  context: AuthContext & { executionCtx: ExecutionContext },
  data: CreateCommentInput,
) {
  const target: CommentTarget = {
    targetType: data.targetType,
    targetId: data.targetId,
  };
  const targetInfo = await requireTarget(context, target);
  if (!targetInfo) {
    return err({ reason: "TARGET_NOT_OPEN" as const });
  }

  if (context.session.user.role !== "admin") {
    const actor = await MutedUserRepo.findUserById(
      context.db,
      context.session.user.id,
    );
    if (isMuted(actor?.mutedAt)) {
      return err({ reason: "USER_MUTED" });
    }
  }

  let rootId: number | null = null;
  let replyToCommentId: number | null = null;

  if (data.rootId) {
    const rootComment = await CommentRepo.findCommentById(
      context.db,
      data.rootId,
    );
    if (!rootComment) {
      return err({ reason: "ROOT_COMMENT_NOT_FOUND" });
    }
    if (rootComment.rootId !== null) {
      return err({ reason: "INVALID_ROOT_ID" });
    }
    if (!sameTarget(rootComment, target)) {
      return err({ reason: "ROOT_COMMENT_TARGET_MISMATCH" });
    }
    rootId = data.rootId;

    if (data.replyToCommentId) {
      const replyToComment = await CommentRepo.findCommentById(
        context.db,
        data.replyToCommentId,
      );
      if (!replyToComment) {
        return err({ reason: "REPLY_TO_COMMENT_NOT_FOUND" });
      }
      const actualRootId = replyToComment.rootId ?? replyToComment.id;
      if (actualRootId !== rootId) {
        return err({ reason: "REPLY_TO_COMMENT_ROOT_MISMATCH" });
      }
      replyToCommentId = data.replyToCommentId;
    } else {
      replyToCommentId = rootId;
    }
  } else if (data.replyToCommentId) {
    return err({ reason: "ROOT_COMMENT_CANNOT_HAVE_REPLY_TO" });
  }

  const isAdmin = context.session.user.role === "admin";

  const comment = await CommentRepo.insertComment(context.db, {
    targetType: data.targetType,
    targetId: data.targetId,
    content: data.content,
    rootId,
    replyToCommentId,
    userId: context.session.user.id,
    status: "published",
  });

  // An Admin's reply handles what it answers, even if later deleted.
  if (isAdmin && replyToCommentId) {
    await CommentRepo.markCommentHandledOnce(
      context.db,
      replyToCommentId,
      new Date(),
    );
  }

  if (replyToCommentId) {
    await sendReplyNotification(context, {
      comment: {
        id: comment.id,
        rootId: comment.rootId,
        replyToCommentId: comment.replyToCommentId,
        userId: comment.userId,
        content: data.content,
      },
      target: {
        title: targetInfo.title,
        label: targetInfo.label,
        commentPath: (commentId) => targetInfo.commentPath(commentId),
      },
    });
  }

  const isRootComment = rootId === null;
  if (!isAdmin && isRootComment) {
    const { DOMAIN } = serverEnv(context.env);
    const commentPreview = data.content.slice(0, 100);
    const commenterName = context.session.user.name;
    await publishNotificationEvent(context, {
      type: "comment.admin_root_created",
      data: {
        postTitle: targetInfo.title,
        targetLabel: targetInfo.label,
        commenterName,
        commentPreview: `${commentPreview}${commentPreview.length >= 100 ? "..." : ""}`,
        commentUrl: `https://${DOMAIN}${targetInfo.commentPath(comment.id)}`,
      },
    });
  }

  const { handledAt: _private, ...publicComment } = comment;
  return ok(publicComment);
}

export async function deleteComment(
  context: AuthContext,
  data: DeleteCommentInput,
) {
  const comment = await CommentRepo.findCommentById(context.db, data.id);

  if (!comment) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }

  const userRole = context.session.user.role;
  if (comment.userId !== context.session.user.id && userRole !== "admin") {
    return err({ reason: "PERMISSION_DENIED" });
  }

  await CommentRepo.updateComment(context.db, data.id, {
    status: "deleted",
  });

  return ok({ success: true });
}

/** Takes a Comment off the unreplied list without replying to it. */
export async function markCommentHandled(
  context: DbContext,
  data: { id: number },
) {
  const marked = await CommentRepo.setCommentHandledAt(
    context.db,
    data.id,
    new Date(),
  );
  if (!marked) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }
  return ok({ success: true });
}

/** Undoes `markCommentHandled`; a Comment an Admin answered stays answered. */
export async function unmarkCommentHandled(
  context: DbContext,
  data: { id: number },
) {
  const unmarked = await CommentRepo.setCommentHandledAt(
    context.db,
    data.id,
    null,
  );
  if (!unmarked) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }
  return ok({ success: true });
}

/** Marks every Comment still waiting for a reply handled. */
export async function markAllUnrepliedCommentsHandled(context: DbContext) {
  const count = await DashboardRepo.markUnrepliedCommentsHandled(
    context.db,
    new Date(),
  );
  return { count };
}

export async function getMyComments(
  context: AuthContext,
  data: GetMyCommentsInput,
) {
  return await CommentRepo.getCommentsByUserId(
    context.db,
    context.session.user.id,
    {
      offset: data.offset,
      limit: data.limit,
      status: data.status,
    },
  );
}
