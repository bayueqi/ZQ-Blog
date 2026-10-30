import { z } from "zod";

const count = z.number().int().nonnegative();
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

/** 首页顶部那排数字，只统计访客看得到的内容。 */
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
