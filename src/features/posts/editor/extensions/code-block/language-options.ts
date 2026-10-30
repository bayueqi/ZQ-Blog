import type { CodeLanguage } from "@/lib/code-languages";

/** A picker entry: a registry language, or plain text, which has no grammar. */
export type LanguageOption = Pick<CodeLanguage, "id" | "label" | "aliases">;

const NO_MATCH = 3;

/** 0 = a name equals the query, 1 = a name starts with it, 2 = contains it. */
function matchRank(option: LanguageOption, needle: string) {
  let rank = NO_MATCH;
  for (const name of [option.label, option.id, ...option.aliases]) {
    const lower = name.toLowerCase();
    if (lower === needle) return 0;
    if (lower.startsWith(needle)) rank = Math.min(rank, 1);
    else if (lower.includes(needle)) rank = Math.min(rank, 2);
  }
  return rank;
}

/**
 * Filters the language picker's options by display name, grammar id or alias,
 * case-insensitively. Exact names come first, then prefixes, then other
 * matches; ties keep list order. A blank query keeps every option.
 */
export function filterLanguageOptions<T extends LanguageOption>(
  options: ReadonlyArray<T>,
  query: string,
): Array<T> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options
    .map((option) => ({ option, rank: matchRank(option, needle) }))
    .filter(({ rank }) => rank < NO_MATCH)
    .sort((a, b) => a.rank - b.rank)
    .map(({ option }) => option);
}
