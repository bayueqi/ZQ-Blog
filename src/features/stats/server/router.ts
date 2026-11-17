import { SiteStatsSchema } from "@/features/stats/stats.schema";
import * as StatsService from "@/features/stats/service/stats.service";
import { publicProcedure } from "@/lib/orpc/procedure";

const stats = publicProcedure
  .route({
    method: "GET",
    path: "/stats",
    summary: "Public counts for the home page",
    description:
      "Counts every published item. Locked or password-protected entries are counted too, and the numbers do not depend on who is asking.",
    tags: ["Stats"],
  })
  .output(SiteStatsSchema)
  .handler(({ context }) => StatsService.getSiteStats(context));

export default {
  stats,
};
