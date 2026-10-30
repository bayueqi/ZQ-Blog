import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MomentsPage } from "@/features/moments/components/moments-page";
import { momentsQuery } from "@/features/moments/queries";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
  comment: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_public/moments/")({
  validateSearch: searchSchema,
  component: MomentsRoute,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(momentsQuery());
    return { title: m.moments_title() };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function MomentsRoute() {
  const { comment } = Route.useSearch();
  const { data } = useSuspenseQuery(momentsQuery());
  return <MomentsPage moments={data.moments} highlightCommentId={comment} />;
}
