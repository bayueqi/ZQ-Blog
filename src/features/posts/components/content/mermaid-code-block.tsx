import { ThemedMermaidDiagram } from "@/components/content/themed-mermaid-diagram";
import { MERMAID } from "@/lib/code-languages";
import { CodeBlockFrame, CodeHtml } from "./code-block";

/**
 * A published Mermaid code block: the snapshot's highlighted source until the
 * diagram renders in the visitor's browser. Not folded like long code; wide
 * diagrams scroll instead. Loaded only for posts that contain one.
 */
export default function MermaidCodeBlock({
  code,
  highlightedHtml,
}: {
  code: string;
  highlightedHtml?: string;
}) {
  return (
    <CodeBlockFrame code={code} language={MERMAID}>
      <ThemedMermaidDiagram
        source={code}
        fallback={<CodeHtml code={code} highlightedHtml={highlightedHtml} />}
      />
    </CodeBlockFrame>
  );
}
