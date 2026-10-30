import { desc, eq, isNotNull } from "drizzle-orm";
import type { DB } from "@/lib/db";
import { MomentsTable, type NewMoment } from "@/lib/db/schema";

/** 前台只看已发布的；置顶在最前，其余新的在前。 */
export function listPublished(db: DB) {
  return db
    .select()
    .from(MomentsTable)
    .where(isNotNull(MomentsTable.publishedAt))
    .orderBy(
      desc(MomentsTable.pinnedAt),
      desc(MomentsTable.publishedAt),
      desc(MomentsTable.id),
    );
}

/** 后台连草稿一起列。 */
export function listAll(db: DB) {
  return db
    .select()
    .from(MomentsTable)
    .orderBy(desc(MomentsTable.createdAt), desc(MomentsTable.id));
}

export async function findById(db: DB, id: number) {
  const [row] = await db
    .select()
    .from(MomentsTable)
    .where(eq(MomentsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function create(db: DB, values: NewMoment) {
  const [row] = await db.insert(MomentsTable).values(values).returning();
  return row ?? null;
}

export async function update(db: DB, id: number, values: Partial<NewMoment>) {
  const [row] = await db
    .update(MomentsTable)
    .set(values)
    .where(eq(MomentsTable.id, id))
    .returning();
  return row ?? null;
}

export async function remove(db: DB, id: number) {
  await db.delete(MomentsTable).where(eq(MomentsTable.id, id));
}
