import { z } from "zod";
import { defineEntry } from "@/features/cache/public-cache";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as TagRepo from "@/features/tags/data/tags.data";
import { TagWithCountSchema } from "@/features/tags/tags.schema";

export const publicTagList = defineEntry({
  name: "tags.publicList",
  key: (_params: Record<string, never>) => ["public", "tags", "list"],
  schema: z.array(TagWithCountSchema),
  ttl: "7d",
  invalidatedBy: ["post.published", "post.deleted", "tag.changed"],
  ttlCap: (context) => PostRepo.nextScheduledPublishAt(context.db),
  load: (context) =>
    TagRepo.getAllTagsWithCount(context.db, {
      publicOnly: true,
      sortBy: "postCount",
      sortDir: "desc",
    }),
});
