// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Editor, EditorContent } from "@tiptap/react";
import { createElement } from "react";
import { findInPopover } from "tests/popover";
import { afterEach, expect, it, vi } from "vitest";
import { createSchemaExtensions } from "@/features/posts/editor/schema";
import { m } from "@/paraglide/messages";
import { CodeBlockExtension } from ".";

// Unmount the popover as soon as it closes; exit motion is not under test.
vi.mock("@/hooks/use-motion", () => ({
  MOTION: { popover: 120 },
  useMotionPresence: (open: boolean) => open,
}));

let editor: Editor | undefined;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  editor?.destroy();
  editor = undefined;
});

async function renderCodeBlock(language: string) {
  const target = new Editor({
    extensions: createSchemaExtensions({ codeBlock: CodeBlockExtension }),
    content: `<pre><code class="language-${language}">const a = 1</code></pre>`,
  });
  editor = target;
  await act(async () => {
    render(createElement(EditorContent, { editor: target }));
  });
  return target;
}

function codeBlockLanguage(target: Editor) {
  return target.getJSON().content?.[0]?.attrs?.language;
}

function trigger() {
  return screen.getByRole("button", { name: m.editor_code_language() });
}

/** Opens the picker and waits until its search box can be typed in. */
async function openPicker() {
  fireEvent.click(trigger());
  return findInPopover("combobox");
}

function optionLabels() {
  return within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((option) => option.textContent);
}

function activeOption(search: HTMLElement) {
  const id = search.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : undefined;
}

it("shows the display name of the block's language, resolving aliases", async () => {
  await renderCodeBlock("ts");

  expect(trigger().textContent).toBe("TypeScript");
});

it("filters by alias as the Admin types and picks the match with Enter", async () => {
  const target = await renderCodeBlock("ts");

  const search = await openPicker();
  expect(document.activeElement).toBe(search);
  fireEvent.change(search, { target: { value: "yml" } });
  expect(optionLabels()).toEqual(["YAML"]);

  fireEvent.keyDown(search, { key: "Enter" });

  expect(codeBlockLanguage(target)).toBe("yaml");
  expect(screen.queryByRole("listbox")).toBeNull();
  await waitFor(() => expect(trigger().textContent).toBe("YAML"));
  expect(document.activeElement).toBe(trigger());
});

it("moves through the filtered list with the arrow keys", async () => {
  const target = await renderCodeBlock("ts");

  const search = await openPicker();
  fireEvent.change(search, { target: { value: "c" } });
  expect(optionLabels().slice(0, 3)).toEqual(["C", "C++", "C#"]);
  expect(activeOption(search)).toBe("C");

  fireEvent.keyDown(search, { key: "ArrowDown" });
  fireEvent.keyDown(search, { key: "ArrowDown" });
  fireEvent.keyDown(search, { key: "ArrowUp" });
  expect(activeOption(search)).toBe("C++");

  fireEvent.keyDown(search, { key: "Enter" });
  expect(codeBlockLanguage(target)).toBe("cpp");
});

it("leaves the list where the Admin scrolled it, and follows the arrow keys", async () => {
  await renderCodeBlock("ts");
  const scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  try {
    const search = await openPicker();
    scrollIntoView.mockClear();

    const listbox = screen.getByRole("listbox");
    fireEvent.scroll(listbox);
    fireEvent.mouseMove(within(listbox).getAllByRole("option")[5]);
    fireEvent.scroll(listbox);
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  } finally {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
});

it("starts on the current language and closes with Escape without changing it", async () => {
  const target = await renderCodeBlock("python");

  const search = await openPicker();
  expect(activeOption(search)).toBe("Python");

  fireEvent.keyDown(search, { key: "Escape" });

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(codeBlockLanguage(target)).toBe("python");
  expect(document.activeElement).toBe(trigger());
});

it("picks a language with the mouse, including plain text", async () => {
  const target = await renderCodeBlock("ts");

  const search = await openPicker();
  fireEvent.change(search, { target: { value: "text" } });
  fireEvent.click(
    within(screen.getByRole("listbox")).getByRole("option", {
      name: m.common_plain_text(),
    }),
  );

  expect(codeBlockLanguage(target)).toBe("text");
});

it("says so when nothing matches and ignores Enter", async () => {
  const target = await renderCodeBlock("ts");

  const search = await openPicker();
  fireEvent.change(search, { target: { value: "cobol" } });
  expect(optionLabels()).toEqual([]);
  expect(screen.getByText(m.editor_code_language_empty())).toBeTruthy();

  fireEvent.keyDown(search, { key: "Enter" });
  expect(codeBlockLanguage(target)).toBe("ts");
  expect(screen.getByRole("combobox")).toBe(search);
});

it("shows plain-text aliases as plain text and starts on that option", async () => {
  await renderCodeBlock("txt");

  expect(trigger().textContent).toBe(m.common_plain_text());
  expect(activeOption(await openPicker())).toBe(m.common_plain_text());
});

it("anchors the popover below the trigger's right edge", async () => {
  await renderCodeBlock("ts");
  // jsdom lays nothing out: give the viewport the window's size.
  const root = document.documentElement;
  vi.spyOn(root, "clientWidth", "get").mockReturnValue(window.innerWidth);
  vi.spyOn(root, "clientHeight", "get").mockReturnValue(window.innerHeight);
  const top = window.innerHeight - 400;
  vi.spyOn(trigger(), "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 800, y: top, width: 100, height: 24 }),
  );

  await openPicker();

  const popover = screen.getByRole("listbox").parentElement as HTMLElement;
  expect(popover.style.position).toBe("fixed");
  // The popover has no size in jsdom, so its right edge is its left.
  expect(popover.style.left).toBe("900px");
  expect(popover.style.top).toBe(`${top + 24 + 6}px`);
  expect(popover.style.transformOrigin).toBe("top right");
});

it("closes without changing the language when the Admin clicks elsewhere", async () => {
  const target = await renderCodeBlock("ts");

  const search = await openPicker();
  fireEvent.mouseDown(search);
  expect(screen.getByRole("listbox")).toBeTruthy();

  fireEvent.mouseDown(document.body);

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(codeBlockLanguage(target)).toBe("ts");
});
