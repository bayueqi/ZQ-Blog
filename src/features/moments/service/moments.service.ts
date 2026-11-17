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
import {
  deleteContentRevisions,
  recordMoment,
} from "@/features/revisions/service/revisions.service";
import type { Moment } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env/server.env";
import { err, ok } from "@/lib/errors";
import { siteDayStart } from "@/lib/site-time";

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

function toCard(row: Moment, locked: boolean, privateIndex: number | null) {
  // 没指定发布时间就按创建时刻对外显示，免得前台缺日期。
  const shownAt = row.publishedAt ?? row.createdAt;
  return {
    id: row.id,
    body: locked ? "" : row.body,
    images: locked ? [] : images(row),
    // 锁着的时候连时间也不给，只留一张没有信息的锁卡片。
    publishedAt: locked || !shownAt ? null : shownAt.toISOString(),
    updatedAt: locked || !row.updatedAt ? null : row.updatedAt.toISOString(),
    locked,
    pinned: !locked && row.pinnedAt != null,
    privateIndex,
  };
}

export async function listPublished(context: MomentsContext) {
  const rows = await Repo.listPublished(context.db);
  // 锁着的日常按列表顺序编号，同一条每次都是同一个数字。
  const privateIndexes = new Map<number, number>();
  let lockedCount = 0;
  for (const row of rows) {
    if (row.accessPasswordHash && context.session?.user.role !== "admin") {
      lockedCount += 1;
      privateIndexes.set(row.id, lockedCount);
    }
  }
  const cards = await Promise.all(
    rows.map(async (row) => {
      const locked = !(await unlocked(context, row));
      // 锁着的按出现顺序编号，界面只显示「私密日常 N」。
      return toCard(
        row,
        locked,
        locked ? (privateIndexes.get(row.id) ?? null) : null,
      );
    }),
  );
  return { moments: cards };
}

export async function listForAdmin(context: MomentsContext) {
  const rows = await Repo.listAll(context.db);
  return {
    moments: rows.map((row) => ({
      ...toCard(row, false, null),
      // 后台编辑要拿库里的原值，不能被展示用的兜底日期带跑。
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      hasPassword: Boolean(row.accessPasswordHash),
      published: row.published,
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

/**
 * 界面上的 YYYY-MM-DD 换成北京时间零点入库，未来的日期就是定时发布。
 * undefined 表示这次不改发布时间，空串表示不指定发布时间。
 */
function publishedAtOf(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const key = (value ?? "").trim();
  return key ? siteDayStart(key) : null;
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
    published: input.published ?? false,
    publishedAt: publishedAtOf(input.publishedAt) ?? null,
  });
  if (!row) return err({ reason: "NOT_FOUND" as const });

  // 发布出去的那一版才进历史，草稿由 recordMoment 自己跳过。
  await recordMoment(context.db, row);

  return ok(toCard(row, false, null));
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
  const publishedAt = publishedAtOf(input.publishedAt);
  const row = await Repo.update(context.db, input.id, {
    body,
    images: normalizeImages(input.images),
    ...(raw === undefined
      ? {}
      : {
          accessPasswordHash: raw ? await hashMomentPassword(raw) : null,
        }),
    ...(input.published === undefined ? {} : { published: input.published }),
    ...(publishedAt === undefined ? {} : { publishedAt }),
  });
  if (!row) return err({ reason: "NOT_FOUND" as const });

  // 发布出去的那一版才进历史，草稿由 recordMoment 自己跳过。
  await recordMoment(context.db, row);

  return ok(toCard(row, false, null));
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
  await deleteContentRevisions(context.db, "moment", input.id);
  return ok({ ok: true });
}
