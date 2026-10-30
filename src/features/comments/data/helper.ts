import { and, eq, inArray, isNull } from "drizzle-orm";
import type { CommentTarget } from "@/features/comments/comments.schema";
import type { CommentStatus } from "@/lib/db/schema";
import { CommentsTable } from "@/lib/db/schema";

/** Narrows Comments to one Post, Moment or Gallery Category. */
export function commentTargetWhere(target: CommentTarget) {
  return and(
    eq(CommentsTable.targetType, target.targetType),
    eq(CommentsTable.targetId, target.targetId),
  );
}

export function buildCommentWhereClause(options: {
  status?: CommentStatus | Array<CommentStatus>;
  target?: CommentTarget;
  userId?: string;
  rootId?: number | null;
  rootOnly?: boolean;
}) {
  const { status, target, userId, rootId, rootOnly } = options;

  const whereClauses = [];

  if (target) {
    whereClauses.push(commentTargetWhere(target));
  }

  if (userId) {
    whereClauses.push(eq(CommentsTable.userId, userId));
  }

  if (rootOnly) {
    whereClauses.push(isNull(CommentsTable.rootId));
  } else if (rootId !== undefined) {
    if (rootId === null) {
      whereClauses.push(isNull(CommentsTable.rootId));
    } else {
      whereClauses.push(eq(CommentsTable.rootId, rootId));
    }
  }

  if (status) {
    if (Array.isArray(status)) {
      whereClauses.push(inArray(CommentsTable.status, status));
    } else {
      whereClauses.push(eq(CommentsTable.status, status));
    }
  }

  return whereClauses.length > 0 ? and(...whereClauses) : undefined;
}
