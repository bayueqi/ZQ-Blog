import type { LanguageRegistration } from "shiki/core";

/**
 * The single list of code block languages the blog supports. The publish-time
 * highlighter, the editor's searchable language picker and the public code
 * block badge all read from here. Importing this module loads no grammar; each
 * grammar is fetched only when its `load` is called.
 */

/**
 * The language id of a code block rendered without a grammar: what the picker
 * stores for plain text and what Shiki highlights unsupported languages as.
 */
export const PLAIN_TEXT = "text";

/** Other names that mean plain text (Markdown fence names). */
export const PLAIN_TEXT_ALIASES: ReadonlyArray<string> = ["txt", "plaintext"];

const plainTextNames = new Set([PLAIN_TEXT, ...PLAIN_TEXT_ALIASES]);

/**
 * Whether a code block's language string (any case) explicitly means plain
 * text. A missing language counts too, since blocks without one store none.
 */
export function isPlainTextLanguage(name: string | null | undefined) {
  if (!name) return true;
  return plainTextNames.has(name.trim().toLowerCase());
}

/** The language id of code blocks rendered as Mermaid diagrams (ADR 0027). */
export const MERMAID = "mermaid";

// Shiki language modules export `default` as an array of LanguageRegistration
export type CodeLanguageModule = { default: Array<LanguageRegistration> };

export interface CodeLanguage {
  /** Shiki grammar id; also the value stored on code blocks picked in the editor. */
  id: string;
  /** Human-readable name shown in the language picker and the public badge. */
  label: string;
  /** Other names that resolve to this language (e.g. Markdown fence names). */
  aliases: ReadonlyArray<string>;
  load: () => Promise<CodeLanguageModule>;
}

export const CODE_LANGUAGES: ReadonlyArray<CodeLanguage> = [
  {
    id: "typescript",
    label: "TypeScript",
    aliases: ["ts"],
    load: () => import("shiki/langs/typescript.mjs"),
  },
  {
    id: "javascript",
    label: "JavaScript",
    aliases: ["js"],
    load: () => import("shiki/langs/javascript.mjs"),
  },
  {
    id: "jsx",
    label: "JSX",
    aliases: [],
    load: () => import("shiki/langs/jsx.mjs"),
  },
  {
    id: "tsx",
    label: "TSX",
    aliases: [],
    load: () => import("shiki/langs/tsx.mjs"),
  },
  {
    id: "python",
    label: "Python",
    aliases: ["py"],
    load: () => import("shiki/langs/python.mjs"),
  },
  {
    id: "java",
    label: "Java",
    aliases: [],
    load: () => import("shiki/langs/java.mjs"),
  },
  {
    id: "c",
    label: "C",
    aliases: [],
    load: () => import("shiki/langs/c.mjs"),
  },
  {
    id: "cpp",
    label: "C++",
    aliases: [],
    load: () => import("shiki/langs/cpp.mjs"),
  },
  {
    id: "csharp",
    label: "C#",
    aliases: [],
    load: () => import("shiki/langs/csharp.mjs"),
  },
  {
    id: "go",
    label: "Go",
    aliases: [],
    load: () => import("shiki/langs/go.mjs"),
  },
  {
    id: "rust",
    label: "Rust",
    aliases: ["rs"],
    load: () => import("shiki/langs/rust.mjs"),
  },
  {
    id: "php",
    label: "PHP",
    aliases: [],
    load: () => import("shiki/langs/php.mjs"),
  },
  {
    id: "ruby",
    label: "Ruby",
    aliases: ["rb"],
    load: () => import("shiki/langs/ruby.mjs"),
  },
  {
    id: "swift",
    label: "Swift",
    aliases: [],
    load: () => import("shiki/langs/swift.mjs"),
  },
  {
    id: "kotlin",
    label: "Kotlin",
    aliases: [],
    load: () => import("shiki/langs/kotlin.mjs"),
  },
  {
    id: "shell",
    label: "Shell",
    aliases: ["sh", "bash", "zsh"],
    load: () => import("shiki/langs/shell.mjs"),
  },
  {
    id: "sql",
    label: "SQL",
    aliases: [],
    load: () => import("shiki/langs/sql.mjs"),
  },
  {
    id: "html",
    label: "HTML",
    aliases: [],
    load: () => import("shiki/langs/html.mjs"),
  },
  {
    id: "css",
    label: "CSS",
    aliases: [],
    load: () => import("shiki/langs/css.mjs"),
  },
  {
    id: "json",
    label: "JSON",
    aliases: [],
    load: () => import("shiki/langs/json.mjs"),
  },
  {
    id: "yaml",
    label: "YAML",
    aliases: ["yml"],
    load: () => import("shiki/langs/yaml.mjs"),
  },
  {
    id: "xml",
    label: "XML",
    aliases: [],
    load: () => import("shiki/langs/xml.mjs"),
  },
  {
    id: "markdown",
    label: "Markdown",
    aliases: ["md"],
    load: () => import("shiki/langs/markdown.mjs"),
  },
  {
    id: "dockerfile",
    label: "Dockerfile",
    aliases: [],
    load: () => import("shiki/langs/dockerfile.mjs"),
  },
  {
    id: "vue",
    label: "Vue",
    aliases: [],
    load: () => import("shiki/langs/vue.mjs"),
  },
  {
    id: "svelte",
    label: "Svelte",
    aliases: [],
    load: () => import("shiki/langs/svelte.mjs"),
  },
  {
    id: "astro",
    label: "Astro",
    aliases: [],
    load: () => import("shiki/langs/astro.mjs"),
  },
  {
    id: "scss",
    label: "SCSS",
    aliases: [],
    load: () => import("shiki/langs/scss.mjs"),
  },
  {
    id: "less",
    label: "Less",
    aliases: [],
    load: () => import("shiki/langs/less.mjs"),
  },
  {
    id: "diff",
    label: "Diff",
    aliases: ["patch"],
    load: () => import("shiki/langs/diff.mjs"),
  },
  {
    id: "toml",
    label: "TOML",
    aliases: [],
    load: () => import("shiki/langs/toml.mjs"),
  },
  {
    id: "ini",
    label: "INI",
    aliases: ["properties"],
    load: () => import("shiki/langs/ini.mjs"),
  },
  {
    id: "powershell",
    label: "PowerShell",
    aliases: ["ps", "ps1", "pwsh"],
    load: () => import("shiki/langs/powershell.mjs"),
  },
  {
    id: "bat",
    label: "Batch",
    aliases: ["batch", "cmd"],
    load: () => import("shiki/langs/bat.mjs"),
  },
  {
    id: "nginx",
    label: "Nginx",
    aliases: [],
    load: () => import("shiki/langs/nginx.mjs"),
  },
  {
    id: "apache",
    label: "Apache",
    aliases: ["apacheconf"],
    load: () => import("shiki/langs/apache.mjs"),
  },
  {
    id: "graphql",
    label: "GraphQL",
    aliases: ["gql"],
    load: () => import("shiki/langs/graphql.mjs"),
  },
  {
    id: "proto",
    label: "Protocol Buffers",
    aliases: ["protobuf"],
    load: () => import("shiki/langs/proto.mjs"),
  },
  {
    id: "make",
    label: "Makefile",
    aliases: ["makefile"],
    load: () => import("shiki/langs/make.mjs"),
  },
  {
    id: "cmake",
    label: "CMake",
    aliases: [],
    load: () => import("shiki/langs/cmake.mjs"),
  },
  {
    id: "lua",
    label: "Lua",
    aliases: [],
    load: () => import("shiki/langs/lua.mjs"),
  },
  {
    id: "dart",
    label: "Dart",
    aliases: [],
    load: () => import("shiki/langs/dart.mjs"),
  },
  {
    id: "scala",
    label: "Scala",
    aliases: [],
    load: () => import("shiki/langs/scala.mjs"),
  },
  {
    id: "haskell",
    label: "Haskell",
    aliases: ["hs"],
    load: () => import("shiki/langs/haskell.mjs"),
  },
  {
    id: "r",
    label: "R",
    aliases: [],
    load: () => import("shiki/langs/r.mjs"),
  },
  {
    id: "elixir",
    label: "Elixir",
    aliases: ["ex", "exs"],
    load: () => import("shiki/langs/elixir.mjs"),
  },
  {
    id: "erlang",
    label: "Erlang",
    aliases: ["erl"],
    load: () => import("shiki/langs/erlang.mjs"),
  },
  {
    id: "zig",
    label: "Zig",
    aliases: [],
    load: () => import("shiki/langs/zig.mjs"),
  },
  {
    id: "nix",
    label: "Nix",
    aliases: [],
    load: () => import("shiki/langs/nix.mjs"),
  },
  {
    id: "latex",
    label: "LaTeX",
    aliases: ["tex"],
    load: () => import("shiki/langs/latex.mjs"),
  },
  {
    id: "viml",
    label: "Vim Script",
    aliases: ["vim", "vimscript"],
    load: () => import("shiki/langs/viml.mjs"),
  },
  {
    id: "groovy",
    label: "Groovy",
    aliases: ["gradle"],
    load: () => import("shiki/langs/groovy.mjs"),
  },
  {
    id: "objective-c",
    label: "Objective-C",
    aliases: ["objc"],
    load: () => import("shiki/langs/objective-c.mjs"),
  },
  {
    id: "perl",
    label: "Perl",
    aliases: ["pl"],
    load: () => import("shiki/langs/perl.mjs"),
  },
  {
    id: "matlab",
    label: "MATLAB",
    aliases: [],
    load: () => import("shiki/langs/matlab.mjs"),
  },
  {
    id: "solidity",
    label: "Solidity",
    aliases: ["sol"],
    load: () => import("shiki/langs/solidity.mjs"),
  },
  {
    id: MERMAID,
    label: "Mermaid",
    aliases: [],
    load: () => import("shiki/langs/mermaid.mjs"),
  },
  {
    id: "prisma",
    label: "Prisma",
    aliases: [],
    load: () => import("shiki/langs/prisma.mjs"),
  },
];

const byName = new Map<string, CodeLanguage>();
for (const language of CODE_LANGUAGES) {
  byName.set(language.id, language);
  for (const alias of language.aliases) byName.set(alias, language);
}

/**
 * Resolves a code block's language string (id or alias, any case) to its
 * supported language. Returns `undefined` for unsupported or empty strings,
 * which callers render as plain text.
 */
export function resolveCodeLanguage(
  name: string | null | undefined,
): CodeLanguage | undefined {
  if (!name) return undefined;
  return byName.get(name.trim().toLowerCase());
}

/** Whether a code block's language string (any case) is Mermaid. */
export function isMermaidLanguage(name: string | null | undefined) {
  return resolveCodeLanguage(name)?.id === MERMAID;
}
