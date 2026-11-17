import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { NotFound } from "@/components/common/not-found";
import { GalleryCategoryPage } from "@/features/gallery/components/gallery-category-page";
import { galleryCategoryQuery } from "@/features/gallery/queries";
import { privateLabelIndex } from "@/lib/private-slug";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
  comment: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_public/gallery/$category/")({
  validateSearch: searchSchema,
  component: GalleryCategoryRoute,
  notFoundComponent: NotFound,
  loader: async ({ context, params }) => {
    // 相册不存在或还是草稿，接口回 404；这里当没这一页处理，别整成 500。
    const data = await context.queryClient
      .ensureQueryData(galleryCategoryQuery(params.category))
      .catch((error: unknown) => {
        if ((error as { status?: number }).status === 404) throw notFound();
        throw error;
      });
    return {
      title: data.locked
        ? `${m.gallery_private_placeholder()} ${privateLabelIndex(params.category)}`
        : data.category.name,
      description: data.locked
        ? undefined
        : (data.category.description ?? undefined),
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
