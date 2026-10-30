import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MediaLibrary } from "@/features/media/components/media-library";
import { MediaLibraryPageSkeleton } from "@/features/media/components/media-library/media-library-skeleton";
import { m } from "@/paraglide/messages";

const mediaSearchSchema = z.object({
  view: z.enum(["grid", "list"]).optional().catch(undefined),
  filter: z.enum(["used", "unused"]).optional().catch(undefined),
});

export const Route = createFileRoute("/admin/media/")({
  ssr: false,
  validateSearch: mediaSearchSchema,
  component: MediaLibrary,
  pendingComponent: MediaLibraryPageSkeleton,
  pendingMs: 0,
  loader: () => ({
    title: m.media_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});
