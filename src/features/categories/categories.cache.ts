import { z } from "zod";
import { defineEntry } from "@/features/cache/public-cache";
import * as CategoryRepo from "@/features/categories/data/categories.data";
import { CategoryWithCountSchema } from "@/features/categories/categories.schema";
import * as PostRepo from "@/features/posts/data/posts.data";

export const publicCategoryList = defineEntry({
  name: "categories.publicList",
  key: (_params: Record<string, never>) => ["public", "categories", "list"],
  schema: z.array(CategoryWithCountSchema),
  ttl: "7d",
  invalidatedBy: ["post.published", "post.deleted", "category.changed"],
  ttlCap: (context) => PostRepo.nextScheduledPublishAt(context.db),
  load: (context) =>
    CategoryRepo.getAllCategoriesWithCount(context.db, {
      publicOnly: true,
      sortBy: "name",
      sortDir: "asc",
    }),
});
