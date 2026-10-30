export const CONTENT_SLICE = 10000;
export const SNIPPET_SLICE = 200;
/** 摘要要把正文里所有命中的句子都带上，总长比单句摘要放宽。 */
export const EXCERPT_SLICE = 1200;
export const SNIPPET_CONTEXT = 60;
export const SCAN_LIMIT = CONTENT_SLICE;
/** 只标原文里真有的字，不做近似匹配：搜「2026年1」不标「2026年2」。 */
export const FUZZY_MAX_DISTANCE = 0;
