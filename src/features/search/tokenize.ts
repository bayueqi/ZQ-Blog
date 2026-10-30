const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

export function tokenizeForSearch(...parts: Array<string | null | undefined>) {
  const text = parts
    .filter((part) => part && part.trim().length > 0)
    .join("\n");
  return Array.from(segmenter.segment(text))
    .filter((item) => item.isWordLike)
    .map((item) => item.segment.toLowerCase())
    .join(" ");
}

/**
 * 用户输入的整串就是一个关键词：分词后作为 FTS 短语，要求这些词连续出现。
 * 搜「2026年1」只命中连着写「2026 年 1x」的地方，不会被拆成「2026」「年」「1」
 * 三个词各自匹配，末尾补 * 让「2026年1」还能命中「2026年10月」。
 */
export function toFtsMatchQuery(query: string) {
  const tokens = Array.from(segmenter.segment(query))
    .filter((item) => item.isWordLike)
    .map((item) => item.segment.toLowerCase().replaceAll('"', '""'))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return null;
  return `"${tokens.join(" ")}"*`;
}

/**
 * 关键词就是用户敲的那一串，空格也算字：不切分，也不忽略空白。
 * 「实 习」找的就是「实 习」，跟「实习」是两回事。
 */
export function queryTerms(query: string) {
  const trimmed = query.trim();
  return trimmed.length > 0 ? [trimmed] : [];
}
