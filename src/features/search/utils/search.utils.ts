import {
  EXCERPT_SLICE,
  FUZZY_MAX_DISTANCE,
  SCAN_LIMIT,
  SNIPPET_CONTEXT,
  SNIPPET_SLICE,
} from "@/features/search/search.constants";

/** 一句最多取这么长，超了就在命中词周围截断，保证高亮词一定落在摘要里。 */
const WINDOW_LIMIT = SNIPPET_CONTEXT * 2;
const SENTENCE_BREAK = /[。！？!?；;\n\r]/;

type MatchWindow = {
  start: number;
  end: number;
  /** 这句是因为哪个词命中入选的，用于点开文章后定位。 */
  term: string;
  /** 该词在全文里第几次出现，从 1 开始。 */
  occurrence: number;
};

/** 一行命中句子：带高亮的 HTML，以及回跳到原文用的定位信息。 */
export type SnippetLine = {
  html: string;
  term: string;
  occurrence: number;
};

type SnippetOptions = {
  snippetSlice?: number;
  snippetContext?: number;
  scanLimit?: number;
  fuzzyMaxDistance?: number;
  maxWindows?: number;
};

/** 标题用：命中处高亮，多句用省略号连成一行。 */
export function buildSnippet({
  text,
  terms,
  fallbackTerm,
  options,
}: {
  text?: string | null;
  terms: Array<string>;
  fallbackTerm: string;
  options?: SnippetOptions;
}) {
  const { source, pieces, token, active, slice, headStart, tailEnd } =
    findSnippetPieces({ text, terms, fallbackTerm, options });

  if (source.length === 0) return null;
  // 标题里没有命中就退回标题本身，不要拿正文顶上。
  if (pieces.length === 0)
    return source.slice(0, Math.min(slice, SNIPPET_SLICE));

  // 命中词所在句子被裁掉的前后内容用省略号带过。
  const excerpt = `${headStart > 0 ? "…" : ""}${pieces
    .map((piece) => piece.text)
    .join(" … ")}${tailEnd < source.length ? "…" : ""}`;

  return highlightHtml(escapeHtml(excerpt), [...active, token ?? ""]);
}

/** 列表用：一句一条，前端按行渲染并用分割线隔开。 */
export function buildSnippets({
  text,
  terms,
  fallbackTerm,
  options,
}: {
  text?: string | null;
  terms: Array<string>;
  fallbackTerm: string;
  options?: SnippetOptions;
}): Array<SnippetLine> {
  const { source, pieces, token, active } = findSnippetPieces({
    text,
    terms,
    fallbackTerm,
    options,
  });

  if (source.length === 0) return [];
  // 正文里压根没有这个词（比如只命中了标签、分类、日期），
  // 就不要硬塞一段正文当摘要。
  if (pieces.length === 0) return [];

  const highlightTerms = [...active, token ?? ""];
  return pieces.map((piece) => ({
    html: highlightHtml(escapeHtml(piece.text), highlightTerms),
    term: piece.term,
    occurrence: piece.occurrence,
  }));
}

function findSnippetPieces({
  text,
  terms,
  fallbackTerm,
  options,
}: {
  text?: string | null;
  terms: Array<string>;
  fallbackTerm: string;
  options?: SnippetOptions;
}) {
  const slice = options?.snippetSlice ?? EXCERPT_SLICE;
  const scanLimit = options?.scanLimit ?? SCAN_LIMIT;
  const fuzzyMaxDistance = options?.fuzzyMaxDistance ?? FUZZY_MAX_DISTANCE;
  const maxWindows = options?.maxWindows ?? Number.POSITIVE_INFINITY;

  const source = text?.trim() ?? "";
  const active = terms.length > 0 ? terms : fallbackTerm ? [fallbackTerm] : [];
  if (source.length === 0 || active.length === 0) {
    return {
      source,
      pieces: [] as Array<{ text: string; term: string; occurrence: number }>,
      token: null as string | null,
      active,
      slice,
      headStart: 0,
      tailEnd: 0,
    };
  }

  const { windows, token } = collectWindows(
    source,
    active,
    scanLimit,
    fuzzyMaxDistance,
  );

  const pieces: Array<{ text: string; term: string; occurrence: number }> = [];
  const seen = new Set<string>();
  let headStart = 0;
  let tailEnd = 0;
  for (const window of windows) {
    const piece = source.slice(window.start, window.end).trim();
    if (!piece) continue;
    // 摘要和正文会有同一句话，按去掉空白后的内容去重。
    const key = piece.replace(/\s+/g, "");
    if (seen.has(key)) continue;
    if (pieces.length >= maxWindows) break;
    if (pieces.length === 0) headStart = window.start;
    seen.add(key);
    // 命中的位置都列出来，不再按句数或字数截断。
    pieces.push({
      text: piece,
      term: window.term,
      occurrence: window.occurrence,
    });
    tailEnd = window.end;
  }

  return { source, pieces, token, active, slice, headStart, tailEnd };
}

function collectWindows(
  source: string,
  terms: Array<string>,
  scanLimit: number,
  maxDistance: number,
): { windows: Array<MatchWindow>; token: string | null } {
  const scan = Math.min(scanLimit, source.length);
  // 文本本来就不长时直接用，少复制一份。
  const lowerSource = (
    source.length > scan ? source.slice(0, scan) : source
  ).toLowerCase();
  const windows: Array<MatchWindow> = [];

  // 先收齐每个关键词的所有出现位置，再按文档顺序排，
  // 否则第一个关键词就会把名额占满。
  for (const term of terms) {
    const needle = term.toLowerCase();
    if (needle.length === 0) continue;
    let from = 0;
    let occurrence = 0;
    while (true) {
      const idx = lowerSource.indexOf(needle, from);
      if (idx === -1) break;
      occurrence += 1;
      windows.push({
        ...sentenceWindow(source, idx, needle.length),
        term: source.slice(idx, idx + needle.length),
        occurrence,
      });
      from = idx + needle.length;
    }
  }

  if (windows.length > 0) {
    return { windows: mergeWindows(windows), token: null };
  }

  // 没找到原词时退到近似命中，命中的那段文字同样要高亮。
  const approx = findApproxMatch(source, terms, scanLimit, maxDistance);
  if (!approx) return { windows: [], token: null };
  return {
    windows: [
      {
        ...sentenceWindow(source, approx.idx, approx.len),
        term: approx.token,
        occurrence: 1,
      },
    ],
    token: approx.token,
  };
}

/** 同一句被多次命中、或长句被截成相邻两段时并成一行，不要重复列。 */
function mergeWindows(windows: Array<MatchWindow>): Array<MatchWindow> {
  const merged: Array<MatchWindow> = [];
  for (const window of [...windows].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    // 只有真正重叠才合并；前后相邻的两句要各占一行。
    if (last && window.start < last.end) {
      last.end = Math.max(last.end, window.end);
      continue;
    }
    merged.push({ ...window });
  }
  return merged;
}

/** 命中词所在的整句；句子过长时以命中词为中心截断。 */
function sentenceWindow(
  source: string,
  idx: number,
  len: number,
): { start: number; end: number } {
  let start = idx;
  while (start > 0 && !SENTENCE_BREAK.test(source[start - 1])) start--;
  let end = idx + len;
  while (end < source.length && !SENTENCE_BREAK.test(source[end])) end++;
  if (end < source.length) end += 1;

  if (end - start > WINDOW_LIMIT) {
    const offset = Math.max(0, Math.floor((WINDOW_LIMIT - len) / 2));
    start = Math.max(start, idx - offset);
    end = Math.min(end, start + WINDOW_LIMIT);
  }

  // 不要在英文单词中间下刀，截断处向两侧找到词边界。
  while (
    start > 0 &&
    isWordChar(source[start - 1]) &&
    isWordChar(source[start])
  ) {
    start--;
  }
  while (
    end < source.length &&
    isWordChar(source[end - 1]) &&
    isWordChar(source[end])
  ) {
    end++;
  }

  while (start < end && /\s/.test(source[start])) start++;
  while (end > start && /\s/.test(source[end - 1])) end--;

  return { start, end };
}

function isWordChar(char: string | undefined) {
  return char !== undefined && /[A-Za-z0-9_]/.test(char);
}

function highlightHtml(escaped: string, terms: Array<string>) {
  const pattern = terms
    .filter((term) => term.length > 0)
    .sort((a, b) => b.length - a.length)
    .map((term) => escapeRegExp(escapeHtml(term)));
  if (pattern.length === 0) return escaped;
  return escaped.replace(
    new RegExp(pattern.join("|"), "gi"),
    (match) => `<mark>${match}</mark>`,
  );
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function findApproxMatch(
  source: string,
  terms: Array<string>,
  scanLimit: number,
  maxDistance: number,
): { idx: number; len: number; token: string } | null {
  // 不允许近似就不必再逐字扫一遍长文，省掉每篇文章一次全文遍历。
  if (maxDistance <= 0) return null;
  const chunk = source.slice(0, Math.min(scanLimit, source.length));
  const lowerChunk = chunk.toLowerCase();

  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    const baseLen = lowerTerm.length;
    const lens = [baseLen - 1, baseLen, baseLen + 1].filter((l) => l > 0);

    for (const winLen of lens) {
      const limit = lowerChunk.length - winLen;
      if (limit < 0) continue;

      for (let i = 0; i <= limit; i++) {
        // quick filter: first char should match to reduce cost
        if (lowerChunk[i] !== lowerTerm[0]) continue;
        const candidate = lowerChunk.slice(i, i + winLen);
        if (
          levenshteinWithCutoff(candidate, lowerTerm, maxDistance) > maxDistance
        ) {
          continue;
        }
        const expanded = expandToWordBounds(chunk, i, winLen);
        return expanded;
      }
    }
  }

  return null;
}

function expandToWordBounds(
  source: string,
  idx: number,
  len: number,
): { idx: number; len: number; token: string } {
  const isWord = (ch: string) => /\w/.test(ch);
  let start = idx;
  let end = idx + len;
  while (start > 0 && isWord(source[start - 1])) start--;
  while (end < source.length && isWord(source[end])) end++;
  return { idx: start, len: end - start, token: source.slice(start, end) };
}

function levenshteinWithCutoff(a: string, b: string, max: number): number {
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > max) return max + 1;
  const prev = Array.from({ length: bLen + 1 }, () => 0);
  const curr = Array.from({ length: bLen + 1 }, () => 0);
  for (let j = 0; j <= bLen; j++) prev[j] = j;
  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= bLen; j++) prev[j] = curr[j];
  }
  return curr[bLen];
}
