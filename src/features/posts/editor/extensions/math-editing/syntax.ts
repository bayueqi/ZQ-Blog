/**
 * Inline math at the start of `src`, by Pandoc's rule: no space after the
 * opening `$`, none before the closing `$`, and no digit right after it, so
 * "$5 to $10" stays text. Group 1 is the LaTeX.
 */
export const INLINE_MATH =
  /^\$(?![\s$])((?:\\[\s\S]|[^\\$])+?)(?<![\s\\])\$(?!\d)/;

/**
 * The inline math that ends `text`, as typing its closing `$` completes it.
 * An opening `$` right after another `$` or a backslash does not count.
 */
export function findInlineMathAtEnd(
  text: string,
): { index: number; text: string; latex: string } | null {
  for (let index = text.lastIndexOf("$", text.length - 2); index >= 0;) {
    const before = text[index - 1];
    const match =
      before === "$" || before === "\\"
        ? null
        : INLINE_MATH.exec(text.slice(index));
    if (match && index + match[0].length === text.length) {
      return { index, text: match[0], latex: match[1] };
    }
    index = index === 0 ? -1 : text.lastIndexOf("$", index - 1);
  }
  return null;
}

/**
 * A line that is just `$$latex$$`, which turns into block math. Group 1 is
 * the LaTeX, which may still be blank.
 */
export const BLOCK_MATH_LINE = /^\$\$(?!\$)((?:\\[\s\S]|[^\\$])+)\$\$$/;
