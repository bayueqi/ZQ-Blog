import { and, asc, eq, isNotNull } from "drizzle-orm";
import { account, user } from "@/lib/db/schema";

export async function findAdminEmail(db: DB) {
  const [admin] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.role, "admin"))
    .orderBy(asc(user.createdAt))
    .limit(1);
  return admin?.email ?? null;
}

export async function userHasPassword(db: DB, userId: string) {
  const userAccount = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), isNotNull(account.password)),
  });

  return !!userAccount;
}
