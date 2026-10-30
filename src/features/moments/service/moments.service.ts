import * as CommentRepo from "@/features/comments/data/comments.data";
import * as Repo from "@/features/moments/data/moments.data";
import {
  hashMomentPassword,
  momentAccessCookieName,
  readCookie,
  verifyMomentAccess,
  verifyMomentPassword,
} from "@/features/moments/moments-access";
import type {
  MomentUpdateInput,
  MomentWriteInput,
} from "@/features/moments/moments.schema";
import type { Moment } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env/server.env";
import { err, ok } from "@/lib/errors";

type MomentsContext = DbContext & {
  headers?: Headers;
  session?: { user: { role?: string | null } } | null;
};

type Locked = { id: number; accessPasswordHash: string | null };

async function unlocked(context: MomentsContext, row: Locked) {
  if (!row.accessPasswordHash) return true;
  if (context.session?.user.role === "admin") return true;
  if (!context.headers) return false;

  return verifyMomentAccess(
    serverEnv(context.env).BETTER_AUTH_SECRET,
    row.id,
    row.accessPasswordHash,
    readCookie(context.headers.get("cookie"), momentAccessCookieName(row.id)),
  );
}

function images(row: Moment) {
  return Array.isArray(row.images) ? row.images : [];
}

function toCard(row: Moment, locked: boolean) {
  return {
    id: row.id,
    body: locked ? "" : row.body,
    images: locked ? [] : images(row),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    locked,
    pinned: row.pinnedAt != null,
  };
}

export async function listPublished(context: MomentsContext) {
  const rows = await Repo.listPublished(context.db);
  const cards = await Promise.all(
    rows.map(async (row) => toCard(row, !(await unlocked(context, row)))),
  );
  return { moments: cards };
}

export async function listForAdmin(context: MomentsContext) {
  const rows = await Repo.listAll(context.db);
  return {
    moments: rows.map((row) => ({
      ...toCard(row, false),
      hasPassword: Boolean(row.accessPasswordHash),
      published: Boolean(row.publishedAt),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    })),
  };
}

/** 只给解锁接口用：密码正确才把正文交出去。 */
export async function unlock(
  context: MomentsContext,
  input: { id: number; password: string },
) {
  const row = await Repo.findById(context.db, input.id);
  if (!row) return err({ reason: "NOT_FOUND" as const });
  if (!row.accessPasswordHash) return err({ reason: "NOT_LOCKED" as const });

  const valid = await verifyMomentPassword(
    input.password,
    row.accessPasswordHash,
  );
  if (!valid) return err({ reason: "WRONG_PASSWORD" as const });

  return ok({ body: row.body, images: images(row) });
}

function passwordOf(password: string | null | undefined) {
  if (password === undefined) return undefined;
  const trimmed = (password ?? "").trim();
  return trimmed ? trimmed : null;
}

/** zod 的图片尺寸可能是 undefined，库里统一存 null。 */
function normalizeImages(
  list: ReadonlyArray<{
    url: string;
    width?: number | null;
    height?: number | null;
  }>,
) {
  return list.map((image) => ({
    url: image.url,
    width: image.width ?? null,
    height: image.height ?? null,
  }));
}

export async function createMoment(
  context: MomentsContext,
  input: MomentWriteInput,
) {
  const body = input.body.trim();
  if (!body && input.images.length === 0)
    return err({ reason: "EMPTY" as const });

  const raw = passwordOf(input.password);
  const row = await Repo.create(context.db, {
    body,
    images: normalizeImages(input.images),
    accessPasswordHash: raw ? await hashMomentPassword(raw) : null,
    publishedAt: input.published ? new Date() : null,
  });
  if (!row) return err({ reason: "NOT_FOUND" as const });

  return ok(toCard(row, false));
}

export async function updateMoment(
  context: MomentsContext,
  input: MomentUpdateInput,
) {
  const existing = await Repo.findById(context.db, input.id);
  if (!existing) return err({ reason: "NOT_FOUND" as const });

  const body = input.body.trim();
  if (!body && input.images.length === 0)
    return err({ reason: "EMPTY" as const });

  const raw = passwordOf(input.password);
  const row = await Repo.update(context.db, input.id, {
    body,
    images: normalizeImages(input.images),
    ...(raw === undefined
      ? {}
      : {
          accessPasswordHash: raw ? await hashMomentPassword(raw) : null,
        }),
    publishedAt:
      input.published && !existing.publishedAt
        ? new Date()
        : input.published
          ? existing.publishedAt
          : null,
  });
  if (!row) return err({ reason: "NOT_FOUND" as const });

  return ok(toCard(row, false));
}

/** 置顶只是排序标记，不影响发布状态与密码。 */
export async function setMomentPinned(
  context: MomentsContext,
  input: { id: number; pinned: boolean },
) {
  const existing = await Repo.findById(context.db, input.id);
  if (!existing) return err({ reason: "NOT_FOUND" as const });

  const row = await Repo.update(context.db, input.id, {
    pinnedAt: input.pinned ? new Date() : null,
  });
  if (!row) return err({ reason: "NOT_FOUND" as const });

  return ok({ id: row.id, pinned: row.pinnedAt != null });
}

export async function removeMoment(
  context: MomentsContext,
  input: { id: number },
) {
  const existing = await Repo.findById(context.db, input.id);
  if (!existing) return err({ reason: "NOT_FOUND" as const });
  await CommentRepo.deleteCommentsByTarget(context.db, {
    targetType: "moment",
    targetId: input.id,
  });
  await Repo.remove(context.db, input.id);
  return ok({ ok: true });
}
