import { normalizePostTagName } from "@/features/posts/schema/posts.schema";

export function getNextPostTagFilter(
  currentTagName: string | undefined,
  selectedTagName: string | undefined,
): { tagName?: string } {
  const normalizedTagName = normalizePostTagName(selectedTagName);
  const tagName =
    normalizedTagName === currentTagName ? undefined : normalizedTagName;
  return tagName === undefined ? {} : { tagName };
}
