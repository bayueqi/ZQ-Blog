import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { getHomeBackgroundPreloadImages } from "@/components/layout/preload-images";
import { siteDomainQuery } from "@/features/config/queries";
import { HomePage } from "@/features/posts/components/home-page";
import { HomePageSkeleton } from "@/features/posts/components/home-page-skeleton";
import { homePostsQuery } from "@/features/posts/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";

export const Route = createFileRoute("/_public/")({
  validateSearch: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000)
      .optional()
      .catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, deps }) => {
    const [posts, domain] = await Promise.all([
      context.queryClient.ensureQueryData(homePostsQuery(deps.page)),
      context.queryClient.ensureQueryData(siteDomainQuery),
    ]);

    if (posts.page !== deps.page) {
      throw redirect({
        to: "/",
        search: { page: posts.page === 1 ? undefined : posts.page },
        replace: true,
      });
    }
    return {
      canonicalHref: buildCanonicalUrl(domain, "/", {
        page: posts.page === 1 ? undefined : String(posts.page),
      }),
      preloadImages: getHomeBackgroundPreloadImages(context.siteConfig),
    };
  },
  head: ({ loaderData }) => ({
    links: [
      canonicalLink(loaderData?.canonicalHref ?? "/"),
      ...(loaderData?.preloadImages ?? []).map((href) => ({
        rel: "preload" as const,
        as: "image",
        href,
      })),
    ],
  }),
  pendingComponent: HomePageSkeleton,
  component: HomeRoute,
});

function HomeRoute() {
  const { page = 1 } = Route.useSearch();
  const { data } = useSuspenseQuery(homePostsQuery(page));
  return (
    <HomePage
      posts={data.items}
      page={data.page}
      totalPages={data.totalPages}
    />
  );
}
