import type { ReactNode } from "react";
import { useTheme } from "@/components/common/theme-provider";
import { MermaidDiagram } from "./mermaid-diagram";

/**
 * A Mermaid code block's diagram inside a code block card, coloured for the
 * current site theme. `fallback` (the block's source) shows until the diagram
 * renders and stays on a syntax error. Shared by published posts and the
 * editor's at-rest preview.
 */
export function ThemedMermaidDiagram({
  source,
  fallback,
}: {
  source: string;
  fallback: ReactNode;
}) {
  const { appTheme } = useTheme();
  return (
    <MermaidDiagram
      source={source}
      theme={appTheme}
      fallback={fallback}
      className="custom-scrollbar [&>svg]:my-4"
    />
  );
}
