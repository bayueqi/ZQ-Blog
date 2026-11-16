import * as GalleryRepo from "@/features/gallery/data/gallery.data";
import * as MomentRepo from "@/features/moments/data/moments.data";
import * as Repo from "@/features/revisions/data/revisions.data";
import type {
  DeleteContentRevisionsInput,
  FindContentRevisionInput,
  ListContentRevisionsInput,
  RestoreContentRevisionInput,
} from "@/features/revisions/revisions.schema";
import type {
  ContentRevisionSnapshot,
  GalleryRevisionSnapshot,
  Moment,
  MomentRevisionSnapshot,
} from "@/lib/db/schema";
import type { GalleryCategory } from "@/lib/db/schema";
import { err, ok } from "@/lib/errors";

/** 每个内容最多留这么多条，多了从最老的开始丢。 */
const MAX_REVISIONS = 30;

const SUMMARY_LENGTH = 60;

function momentSnapshot(row: Moment): MomentRevisionSnapshot {
  return {
    body: row.body,
    images: Array.isArray(row.images) ? row.images : [],
    accessPasswordHash: row.accessPasswordHash,
    published: row.published,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    pinnedAt: row.pinnedAt ? row.pinnedAt.toISOString() : null,
  };
}

async function gallerySnapshot(
  db: DB,
  row: GalleryCategory,
): Promise<GalleryRevisionSnapshot> {
  const photos = await GalleryRepo.listPhotos(db, row.id);
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    coverMediaId: row.coverMediaId,
    accessPasswordHash: row.accessPasswordHash,
    privacyProtected: row.privacyProtected,
    sortOrder: row.sortOrder,
    photos: photos.map((photo) => ({
      mediaId: photo.mediaId,
      url: photo.url,
      width: photo.width,
      height: photo.height,
      mimeType: photo.mimeType,
      caption: photo.caption,
    })),
    published: row.published,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    pinnedAt: row.pinnedAt ? row.pinnedAt.toISOString() : null,
  };
}

/** 和文章一样只留发布版：草稿不进历史；内容和上一版一样也不必再存一份。 */
async function record(
  db: DB,
  targetType: "moment" | "gallery",
  targetId: number,
  snapshot: ContentRevisionSnapshot,
) {
  if (!snapshot.published) return;

  const latest = await Repo.findLatestRevision(db, targetType, targetId);
  if (
    latest &&
    JSON.stringify(latest.snapshotJson) === JSON.stringify(snapshot)
  )
    return;

  await Repo.insertRevision(db, {
    targetType,
    targetId,
    snapshotJson: snapshot,
  });
  await Repo.trimRevisions(db, targetType, targetId, MAX_REVISIONS);
}

/** 日常保存后调一次，把这一版留档；草稿会被跳过。 */
export async function recordMoment(db: DB, row: Moment) {
  await record(db, "moment", row.id, momentSnapshot(row));
}

/** 相册保存后调一次，连同照片留一份；草稿会被跳过。 */
export async function recordGallery(db: DB, row: GalleryCategory) {
  await record(db, "gallery", row.id, await gallerySnapshot(db, row));
}

/** 列表和详情共用：日常取正文开头，相册取名称。 */
function titleOf(
  targetType: "moment" | "gallery",
  snapshot: ContentRevisionSnapshot,
) {
  if (targetType === "moment") {
    return (
      (snapshot as MomentRevisionSnapshot).body
        .trim()
        .slice(0, SUMMARY_LENGTH) || "仅图片/视频"
    );
  }
  return (snapshot as GalleryRevisionSnapshot).name;
}

export async function listContentRevisions(
  context: DbContext,
  input: ListContentRevisionsInput,
) {
  const rows = await Repo.listRevisions(
    context.db,
    input.targetType,
    input.targetId,
    MAX_REVISIONS,
  );

  // 跟当前内容一模一样的那条就是正在生效的版本，界面上标「当前」。
  const currentSnapshot = await currentSnapshotOf(
    context.db,
    input.targetType,
    input.targetId,
  );

  return {
    // 早先留下的草稿快照不再露出来，历史里只有发布版；
    // 相册早期快照没存照片，恢复出来也是空壳，一并略过。
    revisions: rows
      .filter((row) => row.snapshotJson.published)
      .filter(
        (row) =>
          input.targetType === "moment" ||
          Array.isArray((row.snapshotJson as GalleryRevisionSnapshot).photos),
      )
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        title: titleOf(input.targetType, row.snapshotJson),
        published: row.snapshotJson.published,
        publishedAt: row.snapshotJson.publishedAt,
        current: matchesCurrent(currentSnapshot, row.snapshotJson),
      })),
  };
}

function matchesCurrent(
  currentSnapshot: ContentRevisionSnapshot | null,
  snapshot: ContentRevisionSnapshot,
) {
  if (!currentSnapshot) return false;
  return JSON.stringify(currentSnapshot) === JSON.stringify(snapshot);
}

/** 单条快照的完整内容，给历史弹窗右侧预览用。 */
export async function findContentRevision(
  context: DbContext,
  input: FindContentRevisionInput,
) {
  const revision = await Repo.findRevision(
    context.db,
    input.targetType,
    input.targetId,
    input.revisionId,
  );
  if (!revision) return null;

  const currentSnapshot = await currentSnapshotOf(
    context.db,
    input.targetType,
    input.targetId,
  );

  // 快照里存了密码哈希，接口只回一份去掉它的副本。
  const { accessPasswordHash: _accessPasswordHash, ...snapshot } =
    revision.snapshotJson;

  return {
    id: revision.id,
    createdAt: revision.createdAt.toISOString(),
    targetType: input.targetType,
    title: titleOf(input.targetType, revision.snapshotJson),
    snapshot,
    current: matchesCurrent(currentSnapshot, revision.snapshotJson),
  };
}

/** 拿目标此刻的整份内容，用来认出哪条快照是当前版本。 */
async function currentSnapshotOf(
  db: DB,
  targetType: "moment" | "gallery",
  targetId: number,
): Promise<ContentRevisionSnapshot | null> {
  if (targetType === "moment") {
    const row = await MomentRepo.findById(db, targetId);
    return row ? momentSnapshot(row) : null;
  }
  const row = await GalleryRepo.findCategoryById(db, targetId);
  return row ? await gallerySnapshot(db, row) : null;
}

async function restoreMoment(
  db: DB,
  targetId: number,
  snapshot: MomentRevisionSnapshot,
) {
  const row = await MomentRepo.findById(db, targetId);
  if (!row) return err({ reason: "NOT_FOUND" as const });

  // 先把当前值存一份，恢复到一半想反悔还有退路。
  await recordMoment(db, row);

  await MomentRepo.update(db, targetId, {
    body: snapshot.body,
    images: snapshot.images,
    accessPasswordHash: snapshot.accessPasswordHash,
    published: snapshot.published,
    publishedAt: snapshot.publishedAt ? new Date(snapshot.publishedAt) : null,
    pinnedAt: snapshot.pinnedAt ? new Date(snapshot.pinnedAt) : null,
  });
  return ok({ ok: true });
}

async function restoreGallery(
  db: DB,
  targetId: number,
  snapshot: GalleryRevisionSnapshot,
) {
  const row = await GalleryRepo.findCategoryById(db, targetId);
  if (!row) return err({ reason: "NOT_FOUND" as const });

  await recordGallery(db, row);

  // 旧链接可能已经被别的相册占了，那就沿用当前的，不至于恢复不了。
  const taken = await GalleryRepo.findCategorySlugTaken(
    db,
    snapshot.slug,
    targetId,
  );

  await GalleryRepo.updateCategory(db, targetId, {
    name: snapshot.name,
    slug: taken ? row.slug : snapshot.slug,
    description: snapshot.description,
    coverMediaId: snapshot.coverMediaId,
    accessPasswordHash: snapshot.accessPasswordHash,
    privacyProtected: snapshot.privacyProtected,
    sortOrder: snapshot.sortOrder,
    published: snapshot.published,
    publishedAt: snapshot.publishedAt ? new Date(snapshot.publishedAt) : null,
    pinnedAt: snapshot.pinnedAt ? new Date(snapshot.pinnedAt) : null,
  });

  // 照片跟着这一版一起还原；早先的快照里没有照片这一项，不动当前照片。
  if (Array.isArray(snapshot.photos)) {
    await GalleryRepo.deletePhotosOfCategory(db, targetId);
    const mediaIds = await GalleryRepo.findExistingMediaIds(
      db,
      snapshot.photos.map((photo) => photo.mediaId),
    );
    const usable = new Set(mediaIds);
    for (const [index, photo] of snapshot.photos.entries()) {
      // 媒体已被清掉的话就跳过，不让整次恢复失败。
      if (!usable.has(photo.mediaId)) continue;
      await GalleryRepo.insertPhoto(db, {
        categoryId: targetId,
        mediaId: photo.mediaId,
        caption: photo.caption,
        sortOrder: index,
      });
    }
  }

  return ok({ ok: true });
}

export async function restoreContentRevision(
  context: DbContext,
  input: RestoreContentRevisionInput,
) {
  const revision = await Repo.findRevision(
    context.db,
    input.targetType,
    input.targetId,
    input.revisionId,
  );
  if (!revision) return err({ reason: "REVISION_NOT_FOUND" as const });

  if (input.targetType === "moment") {
    return restoreMoment(
      context.db,
      input.targetId,
      revision.snapshotJson as MomentRevisionSnapshot,
    );
  }
  return restoreGallery(
    context.db,
    input.targetId,
    revision.snapshotJson as GalleryRevisionSnapshot,
  );
}

/** 内容删掉时把它的历史一起清掉。 */
export async function deleteContentRevisions(
  db: DB,
  targetType: "moment" | "gallery",
  targetId: number,
) {
  await Repo.deleteRevisionsOf(db, targetType, targetId);
}

/** 在历史列表里删掉点名的版本。 */
export async function deleteContentRevisionEntries(
  context: DbContext,
  input: DeleteContentRevisionsInput,
) {
  const deletedIds = await Repo.deleteRevisionsByIds(
    context.db,
    input.targetType,
    input.targetId,
    [...new Set(input.revisionIds)],
  );

  return { deletedIds, deletedCount: deletedIds.length };
}
