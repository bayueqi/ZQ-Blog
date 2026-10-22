import {
  DashboardOverviewSchema,
  UnrepliedCommentsInputSchema,
  UnrepliedCommentsPageSchema,
} from "@/features/dashboard/dashboard.schema";
import * as DashboardService from "@/features/dashboard/service/dashboard.service";
import { adminProcedure } from "@/lib/orpc/procedure";

const overview = adminProcedure
  .route({
    method: "GET",
    path: "/admin/dashboard",
    summary: "Get admin dashboard overview",
    tags: ["Admin Dashboard"],
  })
  .output(DashboardOverviewSchema)
  .handler(({ context }) => DashboardService.getDashboardOverview(context));

const unrepliedComments = adminProcedure
  .route({
    method: "GET",
    path: "/admin/dashboard/unreplied-comments",
    summary: "List unreplied comments",
    description:
      "Every visitor Comment on a public Post that no Admin has replied to or marked handled, newest first. Pass the previous page's nextBeforeId as beforeId to continue; pages stay stable while Comments leave the list.",
    tags: ["Admin Dashboard"],
  })
  .input(UnrepliedCommentsInputSchema)
  .output(UnrepliedCommentsPageSchema)
  .handler(({ context, input }) =>
    DashboardService.listUnrepliedComments(context, input),
  );

export default {
  overview,
  unrepliedComments,
};
