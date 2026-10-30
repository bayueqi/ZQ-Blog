import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getHomeBackgroundPreloadImages } from "@/components/layout/preload-images";
import { siteDomainQuery } from "@/features/config/queries";
import { galleryCategoriesQuery } from "@/features/gallery/queries";
import { momentsQuery } from "@/features/moments/queries";
import { HomePage } from "@/features/posts/components/home-page";
import { HomePageSkeleton } from "@/features/posts/components/home-page-skeleton";
import { pinnedPostsQuery } from "@/features/posts/queries";
import { siteStatsQuery } from "@/features/stats/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";

export const Route = createFileRoute("/_public/")({
  loader: async ({ context }) => {
    const [, , , , domain] = await Promise.all([
      context.queryClient.ensureQueryData(pinnedPostsQuery()),
      context.queryClient.ensureQueryData(momentsQuery()),
      context.queryClient.ensureQueryData(galleryCategoriesQuery()),
      context.queryClient.ensureQueryData(siteStatsQuery),
      context.queryClient.ensureQueryData(siteDomainQuery),
    ]);

    return {
      canonicalHref: buildCanonicalUrl(domain, "/"),
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
  const { data: stats } = useSuspenseQuery(siteStatsQuery);
  const { data: pinnedPosts } = useSuspenseQuery(pinnedPostsQuery());
  const { data: moments } = useSuspenseQuery(momentsQuery());
  const { data: galleries } = useSuspenseQuery(galleryCategoriesQuery());

  return (
    <HomePage
      stats={stats}
      pinnedPosts={pinnedPosts}
      moments={moments.moments}
      galleries={galleries.categories}
    />
  );
}
