import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import viteDark from "shiki/themes/vitesse-dark.mjs";
import viteLight from "shiki/themes/vitesse-light.mjs";
import { PLAIN_TEXT, resolveCodeLanguage } from "@/lib/code-languages";
import { plainCodeHtml } from "@/lib/plain-code-html";

const themes = {
  light: "vitesse-light",
  dark: "vitesse-dark",
} as const;

let highlighterPromise: Promise<HighlighterCore> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    // Customizing the background color of vitesse-dark to remove the greenish tint
    // using Zinc-900 (#18181b) to match the dark mode UI
    const customViteDark = {
      ...viteDark,
      bg: "#18181b",
      name: "vitesse-dark", // Ensure name matches
    };

    highlighterPromise = createHighlighterCore({
      themes: [customViteDark, viteLight],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

async function loadLanguage(lang: string) {
  const language = resolveCodeLanguage(lang);
  if (!language) return undefined;

  const highlighter = await getHighlighter();
  if (!highlighter.getLoadedLanguages().includes(language.id)) {
    const langModule = await language.load();
    await highlighter.loadLanguage(...langModule.default);
  }
  return language.id;
}

export async function highlight(code: string, lang: string) {
  const safeLang = (await loadLanguage(lang)) ?? PLAIN_TEXT;
  const highlighter = await getHighlighter();

  try {
    return highlighter.codeToHtml(code, {
      lang: safeLang,
      themes: {
        dark: themes.dark,
        light: themes.light,
      },
    });
  } catch (e) {
    console.warn(`Failed to highlight language: ${lang}`, e);
    return plainCodeHtml(code);
  }
}
