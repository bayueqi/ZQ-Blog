import type { MermaidConfig } from "mermaid";

/**
 * Renders Mermaid source to SVG in the browser. The server build replaces the
 * loader with `null`, so Mermaid never reaches the Worker bundle (ADR 0027).
 */
const loadMermaid = import.meta.env.SSR
  ? null
  : () => import("mermaid").then((module) => module.default);

// Mermaid keeps one global config, so renders run one at a time and each one
// initializes with its own theme first.
let queue: Promise<unknown> = Promise.resolve();
let renderCount = 0;

// Mermaid measures each diagram in a temporary element. Left in the body it
// lengthens the page for a moment, so a window scrollbar flashes and the
// layout jumps sideways. A fixed, off-screen host keeps it out of the flow.
let measureHost: HTMLElement | null = null;

function getMeasureHost() {
  if (!measureHost?.isConnected) {
    measureHost = document.createElement("div");
    measureHost.setAttribute("aria-hidden", "true");
    Object.assign(measureHost.style, {
      position: "fixed",
      top: "0",
      left: "-10000px",
      width: "100vw",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.appendChild(measureHost);
  }
  return measureHost;
}

export function renderMermaid(
  source: string,
  themeVariables: Record<string, string | boolean>,
): Promise<string> {
  const run = queue.then(async () => {
    if (!loadMermaid) throw new Error("Mermaid renders only in the browser");
    const mermaid = await loadMermaid();
    const config: MermaidConfig = {
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables,
    };
    mermaid.initialize(config);
    renderCount += 1;
    const { svg } = await mermaid.render(
      `mermaid-diagram-${renderCount}`,
      source,
      getMeasureHost(),
    );
    return svg;
  });
  queue = run.catch(() => undefined);
  return run;
}
