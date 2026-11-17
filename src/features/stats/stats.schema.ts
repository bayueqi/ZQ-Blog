import { z } from "zod";

const count = z.number().int().nonnegative();
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

/** 首页顶部那排数字：只数已发布的条数，不区分访客与管理员、不区分是否加密。 */
export const SiteStatsSchema = z.object({
  posts: count,
  latestPostAt: coercedDate.nullable(),
  moments: count,
  latestMomentAt: coercedDate.nullable(),
  galleries: count,
  photos: count,
  friendLinks: count,
  latestFriendLinkAt: coercedDate.nullable(),
});

export type SiteStats = z.infer<typeof SiteStatsSchema>;
