import { SiteStatsSchema } from "@/features/stats/stats.schema";
import * as StatsService from "@/features/stats/service/stats.service";
import { publicProcedure } from "@/lib/orpc/procedure";

const stats = publicProcedure
  .route({
    method: "GET",
    path: "/stats",
    summary: "Public counts for the home page",
    description:
      "Only counts what a visitor can open: published posts, unprotected galleries and the comments on them.",
    tags: ["Stats"],
  })
  .output(SiteStatsSchema)
  .handler(({ context }) => StatsService.getSiteStats(context));

export default {
  stats,
};
