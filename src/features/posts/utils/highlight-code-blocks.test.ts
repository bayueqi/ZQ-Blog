import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";
import { CODE_LANGUAGES } from "@/lib/code-languages";
import { plainCodeHtml } from "@/lib/plain-code-html";
import { highlightSnapshotContent } from "./highlight-code-blocks";

// One snippet per supported language; each must contain several token kinds.
const SAMPLES: Record<string, string> = {
  apache:
    '<VirtualHost *:80>\n  ServerName example.com\n  DocumentRoot "/var/www"\n</VirtualHost>',
  astro: '---\nconst title = "Hi";\n---\n<h1 class="a">{title}</h1>',
  bat: '@echo off\nset NAME=world\nif "%NAME%"=="world" echo Hello %NAME%',
  c: "#include <stdio.h>\nint main(void) { return 0; }",
  cmake:
    "cmake_minimum_required(VERSION 3.20)\nproject(demo LANGUAGES CXX)\nadd_executable(demo main.cpp)",
  cpp: "#include <vector>\nclass A { public: int x = 1; };",
  csharp: 'public class A { string s = "x"; }',
  css: ".a { color: red; }",
  dart: 'void main() {\n  final s = "x";\n  print(s);\n}',
  diff: "--- a/file.txt\n+++ b/file.txt\n@@ -1,2 +1,2 @@\n-old line\n+new line",
  dockerfile: "FROM node:22\nRUN npm ci",
  elixir: 'defmodule A do\n  def f(x), do: "x#{x}"\nend',
  erlang: '-module(a).\n-export([f/1]).\nf(X) -> {ok, "x", X}.',
  go: 'package main\nfunc main() { s := "x" }',
  graphql: "query GetPost($id: ID!) {\n  post(id: $id) { title }\n}",
  groovy: 'def s = "x"\nclass A { int n = 1 }\nprintln s',
  haskell: 'module Main where\nmain :: IO ()\nmain = putStrLn "x"',
  html: '<div class="a">hi</div>',
  ini: '[server]\nport = 8080\nname = "blog"',
  java: 'public class A { String s = "x"; }',
  javascript: 'const a = "x"; function f() { return 1; }',
  json: '{ "a": 1, "b": true }',
  jsx: 'const el = <div className="a">{1}</div>;',
  kotlin: 'fun main() { val s = "x" }',
  latex:
    "\\documentclass{article}\n\\begin{document}\nHello $x^2$\n\\end{document}",
  less: "@color: red;\n.a { color: @color; .b { margin: 0; } }",
  lua: 'local function f(x)\n  return "x" .. x\nend',
  make: "CC = gcc\nall: main.o\n\t$(CC) -o app main.o",
  markdown: "# Title\n\n**bold** and `code`",
  matlab: "function y = f(x)\n  y = x .^ 2; % square\nend",
  mermaid: 'flowchart LR\n  A["Draft"] -->|publish| B(Published)\n  %% comment',
  nginx:
    "server {\n  listen 80;\n  location / { proxy_pass http://127.0.0.1:3000; }\n}",
  nix: '{ pkgs ? import <nixpkgs> {} }:\npkgs.mkShell { buildInputs = [ pkgs.nodejs ]; name = "dev"; }',
  "objective-c":
    "#import <Foundation/Foundation.h>\n@interface A : NSObject\n@property NSString *s;\n@end",
  perl: 'my $s = "x";\nsub f { return $_[0] + 1; }\nprint $s;',
  php: '<?php $a = "x"; echo $a;',
  powershell:
    '$name = "world"\nfunction Get-Greeting { Write-Output "Hello $name" }',
  prisma:
    "model Post {\n  id    Int    @id @default(autoincrement())\n  title String\n}",
  proto:
    'syntax = "proto3";\nmessage Post {\n  int32 id = 1;\n  string title = 2;\n}',
  python: 'def f(x):\n    return "x"',
  r: 'f <- function(x) {\n  paste("x", x)\n}\nprint(f(1))',
  ruby: 'def f\n  "x"\nend',
  rust: 'fn main() { let s = "x"; }',
  scala: 'object Main {\n  def f(x: Int): String = "x" + x\n}',
  scss: "$color: red;\n.a { color: $color; &:hover { margin: 0; } }",
  shell: 'echo "hi" | grep h\nexport A=1',
  solidity: "pragma solidity ^0.8.0;\ncontract A {\n  uint256 public n = 1;\n}",
  sql: "SELECT id FROM posts WHERE id = 1;",
  svelte:
    "<script>\n  let count = 0;\n</script>\n<button on:click={() => count++}>{count}</button>",
  swift: 'func f() { let s = "x" }',
  toml: '[package]\nname = "blog"\nversion = 1',
  tsx: 'const el: JSX.Element = <div className="a" />;',
  typescript: 'const a: number = 1; function f(): string { return "x"; }',
  viml: 'let g:name = "x"\nfunction! F(x)\n  return a:x + 1\nendfunction',
  vue: '<template>\n  <div :class="a">{{ msg }}</div>\n</template>\n<script setup lang="ts">\nconst msg = "hi";\n</script>',
  xml: '<?xml version="1.0"?><a b="c">d</a>',
  yaml: "key: value\nlist:\n  - 1",
  zig: 'const std = @import("std");\npub fn main() void {\n  const s = "x";\n}',
};

async function highlightBlock(language: string, code: string) {
  const draft: JSONContent = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language },
        content: [{ type: "text", text: code }],
      },
    ],
  };
  const result = await highlightSnapshotContent(draft, null);
  return result?.content?.[0]?.attrs?.highlightedHtml as string;
}

function tokenColors(html: string) {
  return new Set(
    Array.from(html.matchAll(/<span style="color:(#[0-9A-Fa-f]+)/g), (match) =>
      match[1].toLowerCase(),
    ),
  );
}

describe("highlightSnapshotContent", () => {
  it("reuses snapshot HTML and highlights missing blocks", async () => {
    const result = await highlightSnapshotContent(
      {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "ts" },
            content: [{ type: "text", text: "const x = 1;" }],
          },
          {
            type: "codeBlock",
            attrs: { language: "ts" },
            content: [{ type: "text", text: "const y = 2;" }],
          },
        ],
      },
      {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: {
              language: "ts",
              highlightedHtml: "<pre>kept</pre>",
            },
            content: [{ type: "text", text: "const x = 1;" }],
          },
        ],
      },
    );

    expect(result?.content?.[0]?.attrs?.highlightedHtml).toBe(
      "<pre>kept</pre>",
    );
    expect(result?.content?.[1]?.attrs?.highlightedHtml).toEqual(
      expect.stringContaining("shiki"),
    );
  });

  describe("when the snapshot holds plain-text HTML", () => {
    const code = 'const a: number = 1; function f() { return "x"; }';

    async function republish(language: string, snapshotHtml: string) {
      const block = (attrs: Record<string, unknown>): JSONContent => ({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs,
            content: [{ type: "text", text: code }],
          },
        ],
      });
      const result = await highlightSnapshotContent(
        block({ language }),
        block({ language, highlightedHtml: snapshotHtml }),
      );
      return result?.content?.[0]?.attrs?.highlightedHtml as string;
    }

    it("re-highlights it once the language resolves to a grammar", async () => {
      const plainText = await highlightBlock("text", code);

      const html = await republish("ts", plainText);

      expect(html).toBe(await highlightBlock("typescript", code));
      expect(tokenColors(html).size).toBeGreaterThan(1);
    });

    it("re-highlights the error fallback once the language resolves to a grammar", async () => {
      const html = await republish("typescript", plainCodeHtml(code));

      expect(html).toBe(await highlightBlock("typescript", code));
    });

    it("keeps it while the language still has no grammar", async () => {
      const plain = plainCodeHtml(code);

      expect(await republish("not-a-language", plain)).toBe(plain);
      expect(await republish("text", plain)).toBe(plain);
    });
  });

  it("keeps grammar-highlighted snapshot HTML as it is", async () => {
    const code = "const x = 1;";
    const published = (await highlightBlock("ts", code)).replace(
      'tabindex="0"',
      'tabindex="0" data-published="earlier"',
    );
    const block = (attrs: Record<string, unknown>): JSONContent => ({
      type: "doc",
      content: [
        { type: "codeBlock", attrs, content: [{ type: "text", text: code }] },
      ],
    });

    const result = await highlightSnapshotContent(
      block({ language: "ts" }),
      block({ language: "ts", highlightedHtml: published }),
    );

    expect(result?.content?.[0]?.attrs?.highlightedHtml).toBe(published);
  });

  it.each(CODE_LANGUAGES.map((language) => language.id))(
    "highlights %s code with grammar token colors",
    async (id) => {
      const sample = SAMPLES[id];
      expect(sample, `missing test sample for ${id}`).toBeDefined();

      const html = await highlightBlock(id, sample);

      expect(html).toContain('class="shiki');
      expect(tokenColors(html).size).toBeGreaterThan(1);
    },
  );

  it.each(
    CODE_LANGUAGES.flatMap((language) =>
      [...language.aliases, language.id.toUpperCase()].map(
        (alias) => [alias, language.id] as const,
      ),
    ),
  )("highlights %s exactly like %s", async (alias, id) => {
    const sample = SAMPLES[id];

    expect(await highlightBlock(alias, sample)).toBe(
      await highlightBlock(id, sample),
    );
  });

  it("highlights common Markdown fence names", async () => {
    const sample = 'echo "hi" | grep h';
    const shell = await highlightBlock("shell", sample);

    for (const fence of ["sh", "bash", "zsh"]) {
      expect(await highlightBlock(fence, sample)).toBe(shell);
    }
    expect(tokenColors(shell).size).toBeGreaterThan(1);
  });

  it("renders unknown languages as plain text without throwing", async () => {
    const sample = 'const a = "x";';
    const plain = await highlightBlock("text", sample);

    const html = await highlightBlock("not-a-language", sample);

    expect(html).toBe(plain);
    expect(html).toContain('class="shiki');
    expect(tokenColors(html).size).toBe(0);
  });
});
