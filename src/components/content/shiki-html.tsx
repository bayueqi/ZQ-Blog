/**
 * Shiki-highlighted code HTML (a snapshot's `highlightedHtml` or the editor's
 * at-rest preview), padded and sized to scroll inside a code block card.
 */
export function ShikiHtml({ html }: { html: string }) {
  return (
    <div
      className="[&>pre]:px-5 [&>pre]:py-4 [&>pre]:m-0 [&>pre]:min-w-full [&>pre]:w-fit [&_code]:block [&_code]:w-fit [&>pre]:rounded-xl [&>pre>code]:p-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
