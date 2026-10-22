import { orpc } from "@/lib/orpc";
import type { GetCategoriesInput } from "../categories.schema";

export const categoriesQueryOptions = orpc.categories.list.queryOptions();

export const categoryOptionsQuery =
  orpc.categories.admin.options.queryOptions();

export function categoriesAdminQueryOptions(options: GetCategoriesInput = {}) {
  return orpc.categories.admin.list.queryOptions({
    input: { sortBy: "name", sortDir: "asc", ...options },
  });
}
