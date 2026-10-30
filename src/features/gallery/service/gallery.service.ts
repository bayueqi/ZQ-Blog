import { slugify } from "@/features/posts/utils/content";
import * as CommentRepo from "@/features/comments/data/comments.data";
import { err, ok } from "@/lib/errors";
import { serverEnv } from "@/lib/env/server.env";
import * as Repo from "@/features/gallery/data/gallery.data";
import {
  galleryAccessCookieName,
  hashGalleryPassword,
  readCookie,
  signGalleryAccess,
  verifyGalleryAccess,
  verifyGalleryPassword,
} from "@/features/gallery/gallery-access";
import type {
  AddGalleryPhotoInput,
  CreateGalleryCategoryInput,
  UpdateGalleryCategoryInput,
} from "@/features/gallery/gallery.schema";

type GalleryContext = DbContext & {
  headers?: Headers;
  session?: { user: { role?: string | null } } | null;
};

type CategoryRow = Awaited<ReturnType<typeof Repo.listCategories>>[number];
type CategoryBaseRow = Omit<CategoryRow, "createdAt"> & {
  createdAt?: Date | null;
};

function coverOf(row: {
  coverId: number | null;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
}) {
  if (!row.coverId || !row.coverUrl) return null;
  return {
    id: row.coverId,
    url: row.coverUrl,
    width: row.coverWidth,
    height: row.coverHeight,
  };
}

async function unlocked(
  context: GalleryContext,
  row: { id: number; accessPasswordHash: string | null },
) {
  if (!row.accessPasswordHash) return true;
  if (context.session?.user.role === "admin") return true;
  if (!context.headers) return false;
  return await verifyGalleryAccess(
    serverEnv(context.env).BETTER_AUTH_SECRET,
    row.id,
    row.accessPasswordHash,
    readCookie(context.headers.get("cookie"), galleryAccessCookieName(row.id)),
  );
}

function toCategoryCard(row: CategoryBaseRow, isLocked: boolean) {
  // 锁着又开了隐私保护：名称、描述、封面、张数、时间都不下发。
  const concealed = isLocked && row.privacyProtected;
  return {
    id: row.id,
    name: concealed ? "" : row.name,
    slug: row.slug,
    description: concealed ? null : row.description,
    cover: concealed ? null : coverOf(row),
    photoCount: concealed ? 0 : row.photoCount,
    locked: isLocked,
    pinned: row.pinnedAt != null,
    privacyProtected: row.privacyProtected,
    published: row.publishedAt != null,
    createdAt: concealed || !row.createdAt ? null : row.createdAt.toISOString(),
  };
}

/** 后台用：带 hasAccessPassword，但不带 hash 本身。后台不做遮蔽。 */
function toCategoryAdminCard(row: CategoryRow) {
  return {
    ...toCategoryCard(row, false),
    locked: Boolean(row.accessPasswordHash),
    hasAccessPassword: Boolean(row.accessPasswordHash),
    sortOrder: row.sortOrder,
  };
}

export async function listCategories(context: GalleryContext) {
  // 草稿只有管理员能看到。
  const rows = await Repo.listCategories(context.db, {
    publishedOnly: context.session?.user.role !== "admin",
  });
  const cards = await Promise.all(
    rows.map(async (row) =>
      toCategoryCard(row, !(await unlocked(context, row))),
    ),
  );
  return { categories: cards };
}

export async function listCategoriesAdmin(context: GalleryContext) {
  const rows = await Repo.listCategories(context.db);
  return {
    categories: rows.map((row) => toCategoryAdminCard(row)),
  };
}

export async function getCategory(
  context: GalleryContext,
  input: { slug: string },
) {
  const row = await Repo.findCategoryBySlug(context.db, input.slug);
  if (!row) return null;
  // 草稿相册对访客就是不存在。
  if (row.publishedAt == null && context.session?.user.role !== "admin")
    return null;

  const isUnlocked = await unlocked(context, row);
  const counts = await Repo.listCategories(context.db);
  const counted = counts.find((item) => item.id === row.id);
  const card = toCategoryCard(
    { ...row, photoCount: counted?.photoCount ?? 0 },
    !isUnlocked,
  );

  if (!isUnlocked) return { category: card, photos: [], locked: true };

  const photos = await Repo.listPhotos(context.db, row.id);
  return {
    category: card,
    photos: photos.map((photo) => ({
      id: photo.id,
      mediaId: photo.mediaId,
      url: photo.url,
      width: photo.width,
      height: photo.height,
      caption: photo.caption,
    })),
    locked: false,
  };
}

/** 校验密码并返回要写进 cookie 的令牌。 */
export async function unlockCategory(
  context: GalleryContext,
  input: { categoryId: number; password: string },
) {
  const category = await Repo.findCategoryById(context.db, input.categoryId);
  if (!category?.accessPasswordHash)
    return err({ reason: "NOT_LOCKED" as const });
  const matched = await verifyGalleryPassword(
    input.password,
    category.accessPasswordHash,
  );
  if (!matched) return err({ reason: "WRONG_PASSWORD" as const });
  const token = await signGalleryAccess(
    serverEnv(context.env).BETTER_AUTH_SECRET,
    category.id,
    category.accessPasswordHash,
  );
  return ok({ token });
}

/** 相册集的链接由名称生成；重名时自动加序号，改了名就重新生成。 */
async function uniqueSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>,
) {
  const root = slugify(base);
  let candidate = root;
  let index = 2;
  while (await taken(candidate)) {
    candidate = `${root}-${index}`;
    index += 1;
  }
  return candidate;
}

export async function createCategory(
  context: GalleryContext,
  input: CreateGalleryCategoryInput,
) {
  const slug = await uniqueSlug(input.name, (value) =>
    Repo.findCategorySlugTaken(context.db, value),
  );

  const row = await Repo.insertCategory(context.db, {
    name: input.name,
    slug,
    description: input.description ?? null,
    coverMediaId: input.coverMediaId ?? null,
    accessPasswordHash: input.password
      ? await hashGalleryPassword(input.password)
      : null,
    privacyProtected: Boolean(input.password && input.privacyProtected),
    // 没勾发布就是草稿，前台看不到。
    publishedAt: input.published ? new Date() : null,
  });
  return ok(row);
}

export async function updateCategory(
  context: GalleryContext,
  input: UpdateGalleryCategoryInput,
) {
  const existing = await Repo.findCategoryById(context.db, input.id);
  if (!existing) return err({ reason: "NOT_FOUND" as const });

  const data: Partial<typeof existing> = {};
  if (input.name !== undefined && input.name !== existing.name) {
    data.name = input.name;
    // 名称变了链接跟着变，被别的相册占用时自动加序号。
    data.slug = await uniqueSlug(input.name, (value) =>
      Repo.findCategorySlugTaken(context.db, value, existing.id),
    );
  }
  if (input.description !== undefined)
    data.description = input.description ?? null;
  if (input.coverMediaId !== undefined) data.coverMediaId = input.coverMediaId;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  // 传 null 表示取消密码；不传则保持原样。
  if (input.password !== undefined) {
    data.accessPasswordHash = input.password
      ? await hashGalleryPassword(input.password)
      : null;
  }
  if (input.privacyProtected !== undefined) {
    data.privacyProtected = input.privacyProtected;
  }
  if (input.published !== undefined) {
    // 已经发布过的保留原发布时间，取消发布就清空。
    data.publishedAt = input.published
      ? (existing.publishedAt ?? new Date())
      : null;
  }
  // 密码没了，隐私保护也就没有意义。
  if (data.accessPasswordHash === null) data.privacyProtected = false;

  const row = await Repo.updateCategory(context.db, input.id, data);
  return ok(row);
}

/** 置顶只是排序标记，不动密码与隐私设置。 */
export async function setCategoryPinned(
  context: GalleryContext,
  input: { id: number; pinned: boolean },
) {
  const existing = await Repo.findCategoryById(context.db, input.id);
  if (!existing) return err({ reason: "NOT_FOUND" as const });

  const row = await Repo.updateCategory(context.db, input.id, {
    pinnedAt: input.pinned ? new Date() : null,
  });
  if (!row) return err({ reason: "NOT_FOUND" as const });

  return ok({ id: row.id, pinned: row.pinnedAt != null });
}

export async function deleteCategory(context: GalleryContext, id: number) {
  await CommentRepo.deleteCommentsByTarget(context.db, {
    targetType: "gallery",
    targetId: id,
  });
  await Repo.deleteCategory(context.db, id);
  return ok({ id });
}

export async function listPhotosAdmin(
  context: GalleryContext,
  categoryId: number,
) {
  const photos = await Repo.listPhotos(context.db, categoryId);
  return {
    photos: photos.map((photo) => ({
      id: photo.id,
      mediaId: photo.mediaId,
      url: photo.url,
      width: photo.width,
      height: photo.height,
      caption: photo.caption,
    })),
  };
}

export async function addPhoto(
  context: GalleryContext,
  input: AddGalleryPhotoInput,
) {
  const row = await Repo.insertPhoto(context.db, {
    categoryId: input.categoryId,
    mediaId: input.mediaId,
    caption: input.caption ?? null,
  });
  return ok(row);
}

export async function deletePhoto(context: GalleryContext, id: number) {
  await Repo.deletePhoto(context.db, id);
  return ok({ id });
}

export async function updatePhoto(
  context: GalleryContext,
  input: { id: number; caption?: string | null; sortOrder?: number },
) {
  const row = await Repo.updatePhoto(context.db, input.id, {
    caption: input.caption,
    sortOrder: input.sortOrder,
  });
  if (!row) return err({ reason: "NOT_FOUND" as const });
  return ok(row);
}
