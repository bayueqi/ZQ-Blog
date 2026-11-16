import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import type { DB } from "@/lib/db";
import {
  ContentRevisionsTable,
  type ContentRevisionSnapshot,
  type ContentRevisionTarget,
} from "@/lib/db/schema";

function target(targetType: ContentRevisionTarget, targetId: number) {
  return and(
    eq(ContentRevisionsTable.targetType, targetType),
    eq(ContentRevisionsTable.targetId, targetId),
  );
}

/** 新的在前；后台只列最近这些条。 */
export function listRevisions(
  db: DB,
  targetType: ContentRevisionTarget,
  targetId: number,
  limit: number,
) {
  return db
    .select()
    .from(ContentRevisionsTable)
    .where(target(targetType, targetId))
    .orderBy(
      desc(ContentRevisionsTable.createdAt),
      desc(ContentRevisionsTable.id),
    )
    .limit(limit);
}

export async function findRevision(
  db: DB,
  targetType: ContentRevisionTarget,
  targetId: number,
  revisionId: number,
) {
  const [row] = await db
    .select()
    .from(ContentRevisionsTable)
    .where(
      and(
        target(targetType, targetId),
        eq(ContentRevisionsTable.id, revisionId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findLatestRevision(
  db: DB,
  targetType: ContentRevisionTarget,
  targetId: number,
) {
  const [row] = await listRevisions(db, targetType, targetId, 1);
  return row ?? null;
}

export async function insertRevision(
  db: DB,
  values: {
    targetType: ContentRevisionTarget;
    targetId: number;
    snapshotJson: ContentRevisionSnapshot;
  },
) {
  const [row] = await db
    .insert(ContentRevisionsTable)
    .values(values)
    .returning();
  return row ?? null;
}

/** 只留最近 `keep` 条，多出来的从最老的开始删。 */
export async function trimRevisions(
  db: DB,
  targetType: ContentRevisionTarget,
  targetId: number,
  keep: number,
) {
  const kept = db
    .select({ id: ContentRevisionsTable.id })
    .from(ContentRevisionsTable)
    .where(target(targetType, targetId))
    .orderBy(
      desc(ContentRevisionsTable.createdAt),
      desc(ContentRevisionsTable.id),
    )
    .limit(keep);

  await db
    .delete(ContentRevisionsTable)
    .where(
      and(
        target(targetType, targetId),
        notInArray(ContentRevisionsTable.id, kept),
      ),
    );
}

/** 目标内容被删掉时一起清掉，免得留下没有主人的记录。 */
export async function deleteRevisionsOf(
  db: DB,
  targetType: ContentRevisionTarget,
  targetId: number,
) {
  await db.delete(ContentRevisionsTable).where(target(targetType, targetId));
}

/** 只删点名的这几条，别的内容的历史不受影响。 */
export async function deleteRevisionsByIds(
  db: DB,
  targetType: ContentRevisionTarget,
  targetId: number,
  revisionIds: ReadonlyArray<number>,
) {
  const rows = await db
    .delete(ContentRevisionsTable)
    .where(
      and(
        target(targetType, targetId),
        inArray(ContentRevisionsTable.id, [...revisionIds]),
      ),
    )
    .returning({ id: ContentRevisionsTable.id });
  return rows.map((row) => row.id);
}
