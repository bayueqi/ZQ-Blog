/**
 * The HTML a code block gets when it is rendered without a grammar, and how to
 * recognise it again in a stored snapshot. Kept free of Shiki so the admin
 * client can check snapshot HTML without loading the highlighter.
 *
 * Plain HTML comes in two shapes:
 * - `plainCodeHtml`: a bare `<pre><code>`, stored when highlighting throws.
 * - Shiki's `PLAIN_TEXT` output (see `@/lib/shiki`): a `<pre class="shiki ...">`
 *   whose tokens are bare `<span>`s. Grammar output gives every token a style
 *   attribute, even default-coloured ones, and escaped source text can never
 *   contain one.
 *
 * Snapshots already published hold both shapes, so neither may change without
 * keeping the old one recognised.
 */

export function escapeCodeHtml(code: string) {
  return code
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Escaped source in a bare `<pre><code>`, for when highlighting fails. */
export function plainCodeHtml(code: string) {
  return `<pre><code>${escapeCodeHtml(code)}</code></pre>`;
}

/** Whether stored code block HTML was rendered without a grammar. */
export function isPlainCodeHtml(html: string) {
  if (html.startsWith("<pre><code>")) return true;
  return html.startsWith('<pre class="shiki') && !html.includes("<span style=");
}
