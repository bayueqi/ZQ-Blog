import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AdminCommentsPage } from "@/features/comments/components/admin-comments-page";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
  tab: z.enum(["all", "unreplied", "replied", "mine", "muted"]).optional(),
});

export const Route = createFileRoute("/admin/comments/")({
  ssr: false,
  validateSearch: searchSchema,
  component: AdminCommentsRoute,
  loader: () => ({
    title: m.admin_comments_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

function AdminCommentsRoute() {
  const { tab } = Route.useSearch();
  return <AdminCommentsPage initialTab={tab} />;
}
