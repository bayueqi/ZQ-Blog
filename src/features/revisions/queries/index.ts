import { orpc } from "@/lib/orpc";

export interface ContentRevisionQueryInput {
  targetType: "moment" | "gallery";
  targetId: number;
}

export function contentRevisionsQuery(input: ContentRevisionQueryInput) {
  return orpc.revisions.admin.list.queryOptions({ input });
}

export function contentRevisionDetailQuery(
  input: ContentRevisionQueryInput & { revisionId: number },
) {
  return orpc.revisions.admin.get.queryOptions({ input });
}
