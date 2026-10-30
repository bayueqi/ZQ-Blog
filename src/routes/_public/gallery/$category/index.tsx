import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { GalleryCategoryPage } from "@/features/gallery/components/gallery-category-page";
import { galleryCategoryQuery } from "@/features/gallery/queries";

const searchSchema = z.object({
  comment: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_public/gallery/$category/")({
  validateSearch: searchSchema,
  component: GalleryCategoryRoute,
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      galleryCategoryQuery(params.category),
    );
    return {
      title: data.category.name,
      description: data.category.description ?? undefined,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title },
      { name: "description", content: loaderData?.description },
    ],
  }),
});

function GalleryCategoryRoute() {
  const { category } = Route.useParams();
  const { comment } = Route.useSearch();
  const { data } = useSuspenseQuery(galleryCategoryQuery(category));

  return (
    <GalleryCategoryPage
      category={data.category}
      photos={data.photos}
      locked={data.locked}
      highlightCommentId={comment}
    />
  );
}
