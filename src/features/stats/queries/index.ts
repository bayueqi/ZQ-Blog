import { orpc } from "@/lib/orpc";

/** 首页顶部那排数字；短缓存，避免每次进首页都数一遍。 */
export const siteStatsQuery = orpc.stats.stats.queryOptions({
  staleTime: 5 * 60 * 1000,
});
