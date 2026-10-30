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

export function toFtsMatchQuery(query: string) {
  const tokens = Array.from(segmenter.segment(query))
    .filter((item) => item.isWordLike)
    .map((item) => item.segment.toLowerCase().replaceAll('"', '""'))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return null;
  // FTS5 默认整词匹配，补一个 * 号前缀通配：搜「11」才能命中「111」。
  return tokens.map((token) => `"${token}"*`).join(" ");
}

export function queryTerms(query: string) {
  return Array.from(segmenter.segment(query))
    .filter((item) => item.isWordLike)
    .map((item) => item.segment)
    .filter((token) => token.length > 0);
}
