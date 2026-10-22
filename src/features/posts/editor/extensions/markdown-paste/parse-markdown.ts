import type {
  AnyExtension,
  JSONContent,
  MarkdownToken,
  MarkdownTokenizer,
} from "@tiptap/core";
import { flattenExtensions, getExtensionField } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import type { marked } from "marked";
import { Marked } from "marked";
import { INLINE_MATH } from "@/features/posts/editor/extensions/math-editing/syntax";
import { createSchemaExtensions } from "@/features/posts/editor/schema";

const MIN_HEADING_LEVEL = 2;
const MAX_HEADING_LEVEL = 4;

const FRONT_MATTER = /^﻿?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

const BLOCK_MATH = /^ {0,3}\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/;
const BLOCK_MATH_START = /(?:^|\n)(?= {0,3}\$\$)/;

const REMOTE_URL = /^(?:https?:)?\/\//i;

const inlineMathTokenizer: MarkdownTokenizer = {
  name: "inlineMath",
  level: "inline",
  start: (src) => src.indexOf("$"),
  tokenize: (src) => {
    // `$$` inside a paragraph is not math; take the whole run as text so its
    // second `$` cannot open inline math.
    const dollars = /^\$\$[^$]*\$\$|^\$\$+/.exec(src);
    if (dollars) return { type: "text", raw: dollars[0], text: dollars[0] };

    const match = INLINE_MATH.exec(src);
    if (!match) return undefined;
    return { type: "inlineMath", raw: match[0], latex: match[1] };
  },
};

const blockMathTokenizer: MarkdownTokenizer = {
  name: "blockMath",
  level: "block",
  // Only a `$$` at the start of a line opens block math.
  start: (src) => {
    const match = BLOCK_MATH_START.exec(src);
    if (!match) return -1;
    return match.index + match[0].length;
  },
  tokenize: (src) => {
    const match = BLOCK_MATH.exec(src);
    if (!match) return undefined;
    return { type: "blockMath", raw: match[0], latex: match[1].trim() };
  },
};

/**
 * The editor has no task list, so `- [ ] item` keeps its marker as text
 * inside a plain list item.
 */
function withLiteralTaskMarker(token: MarkdownToken): MarkdownToken {
  if (token.type !== "list_item" || !token.task) return token;

  const marker = `[${token.checked ? "x" : " "}] `;
  const markerToken = { type: "text", raw: marker, text: marker };
  const [first, ...rest] = (token.tokens ?? []).filter(
    (child) => child.type !== "checkbox",
  );
  const tokens =
    first && (first.type === "text" || first.type === "paragraph")
      ? [
          {
            ...first,
            text: marker + (first.text ?? ""),
            tokens: [markerToken, ...(first.tokens ?? [])],
          },
          ...rest,
        ]
      : [markerToken, ...(first ? [first, ...rest] : [])];

  return {
    ...token,
    task: false,
    text: marker + (token.text ?? ""),
    tokens,
  };
}

const markdownOverrides: Record<
  string,
  (extension: AnyExtension) => AnyExtension
> = {
  inlineMath: (extension) =>
    extension.extend({
      markdownTokenizer: inlineMathTokenizer,
      parseMarkdown: (token: MarkdownToken) => ({
        type: "inlineMath",
        attrs: { latex: token.latex },
      }),
    }),
  blockMath: (extension) =>
    extension.extend({
      markdownTokenizer: blockMathTokenizer,
      parseMarkdown: (token: MarkdownToken) => ({
        type: "blockMath",
        attrs: { latex: token.latex },
      }),
    }),
  listItem: (extension) =>
    extension.extend({
      parseMarkdown(token, helpers) {
        return this.parent?.(withLiteralTaskMarker(token), helpers) ?? [];
      },
    }),
};

function createMarkdownExtensions(): Array<AnyExtension> {
  return flattenExtensions(createSchemaExtensions()).map((extension) => {
    // MarkdownManager flattens again; a parent would re-add its children
    // without the overrides.
    const flat = getExtensionField(extension, "addExtensions")
      ? extension.extend({ addExtensions: () => [] })
      : extension;
    return markdownOverrides[flat.name]?.(flat) ?? flat;
  });
}

function createMarked() {
  const marked = new Marked();
  marked.use({
    tokenizer: {
      // There are no footnotes; keep `[^1]: note` as text instead of letting
      // it vanish as a link reference definition.
      def(src) {
        return /^ {0,3}\[\^/.test(src) ? undefined : false;
      },
    },
  });
  return marked;
}

let manager: MarkdownManager | undefined;

function getManager() {
  manager ??= new MarkdownManager({
    // An own instance keeps the tokenizers off the shared `marked` singleton.
    marked: createMarked() as unknown as typeof marked,
    extensions: createMarkdownExtensions(),
  });
  return manager;
}

function imageAsText(node: JSONContent): JSONContent {
  const alt = node.attrs?.alt ?? "";
  const src = node.attrs?.src ?? "";
  return { type: "text", text: `![${alt}](${src})` };
}

function isRemoteImage(node: JSONContent) {
  return REMOTE_URL.test(node.attrs?.src ?? "");
}

function minHeadingLevel(nodes: Array<JSONContent>): number {
  return nodes.reduce((min, node) => {
    const own =
      node.type === "heading"
        ? (node.attrs?.level ?? min)
        : Number.POSITIVE_INFINITY;
    return Math.min(min, own, minHeadingLevel(node.content ?? []));
  }, Number.POSITIVE_INFINITY);
}

interface NormalizeContext {
  headingOffset: number;
  localImageCount: number;
}

function normalizeInline(
  nodes: Array<JSONContent>,
  context: NormalizeContext,
): Array<JSONContent> {
  return nodes.map((node) => {
    if (node.type !== "image") return node;
    if (!isRemoteImage(node)) context.localImageCount += 1;
    return imageAsText(node);
  });
}

/** Images are blocks in the editor, so a paragraph splits around them. */
function splitParagraph(
  paragraph: JSONContent,
  context: NormalizeContext,
): Array<JSONContent> {
  const content = paragraph.content ?? [];
  if (!content.some((node) => node.type === "image")) return [paragraph];

  const blocks: Array<JSONContent> = [];
  let run: Array<JSONContent> = [];
  const flush = () => {
    if (run.some((node) => node.type !== "text" || node.text?.trim())) {
      blocks.push({ ...paragraph, content: run });
    }
    run = [];
  };

  for (const node of content) {
    if (node.type !== "image") {
      run.push(node);
    } else if (isRemoteImage(node)) {
      flush();
      blocks.push(node);
    } else {
      context.localImageCount += 1;
      run.push(imageAsText(node));
    }
  }
  flush();
  return blocks;
}

function normalizeBlocks(
  blocks: Array<JSONContent>,
  context: NormalizeContext,
): Array<JSONContent> {
  return blocks.flatMap((block): Array<JSONContent> => {
    switch (block.type) {
      case "image":
        if (isRemoteImage(block)) return [block];
        context.localImageCount += 1;
        return [{ type: "paragraph", content: [imageAsText(block)] }];
      case "paragraph":
        return splitParagraph(block, context);
      case "heading": {
        const level =
          (block.attrs?.level ?? MIN_HEADING_LEVEL) + context.headingOffset;
        return [
          {
            ...block,
            attrs: {
              ...block.attrs,
              level: Math.min(
                Math.max(level, MIN_HEADING_LEVEL),
                MAX_HEADING_LEVEL,
              ),
            },
            content: normalizeInline(block.content ?? [], context),
          },
        ];
      }
      case "codeBlock":
        return [block];
      default: {
        if (!block.content) return [block];
        const content = normalizeBlocks(block.content, context);
        if (block.type === "listItem" && content[0]?.type !== "paragraph") {
          content.unshift({ type: "paragraph" });
        }
        return [{ ...block, content }];
      }
    }
  });
}

export interface PastedMarkdown {
  content: Array<JSONContent>;
  /** Images with a local path, kept as `![alt](path)` text. */
  localImageCount: number;
}

export function parsePastedMarkdown(markdown: string): PastedMarkdown {
  const parsed = getManager().parse(markdown.replace(FRONT_MATTER, ""));
  const content = parsed.content ?? [];
  const minLevel = minHeadingLevel(content);
  const context: NormalizeContext = {
    headingOffset: Number.isFinite(minLevel) ? MIN_HEADING_LEVEL - minLevel : 0,
    localImageCount: 0,
  };

  return {
    content: normalizeBlocks(content, context),
    localImageCount: context.localImageCount,
  };
}

const PARSED_EDITOR_MODES = new Set(["markdown", "plaintext"]);

/**
 * The Markdown to parse from a paste, or null to leave it to the default
 * handlers: HTML, files, code from VS Code, pastes inside a code block, and
 * Ctrl+Shift+V.
 */
export function getPastedMarkdown(
  clipboard: Pick<DataTransfer, "getData" | "types" | "files"> | null,
  { inCode, plainText }: { inCode: boolean; plainText: boolean },
): string | null {
  if (!clipboard || inCode || plainText) return null;
  if (clipboard.files.length > 0) return null;

  const text = clipboard.getData("text/plain");
  if (!text.trim()) return null;

  const vscode = clipboard.getData("vscode-editor-data");
  if (vscode) {
    let mode: unknown;
    try {
      mode = JSON.parse(vscode)?.mode;
    } catch {
      return null;
    }
    return typeof mode === "string" && PARSED_EDITOR_MODES.has(mode)
      ? text
      : null;
  }

  if (Array.from(clipboard.types).includes("text/html")) return null;
  return text;
}
