import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GalleryIndexPage } from "@/features/gallery/components/gallery-index-page";
import { galleryCategoriesQuery } from "@/features/gallery/queries";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/gallery/")({
  component: GalleryIndexRoute,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(galleryCategoriesQuery());
    return {
      title: m.gallery_title(),
    };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function GalleryIndexRoute() {
  const { data } = useSuspenseQuery(galleryCategoriesQuery());
  return <GalleryIndexPage categories={data.categories} />;
}
