/**
 * Test helpers for the post editor. Tests drive the editor the way a user
 * does: typing goes through the editor's text-input handlers (so input rules
 * and suggestions see it) and keys are dispatched as DOM keydown events.
 * Import only from tests that run in jsdom.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { Editor as HeadlessEditor } from "@tiptap/core";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/react";
import { createElement } from "react";
import { Editor } from "@/components/tiptap-editor";
import { extensions } from "@/features/posts/editor/config";

/** A headless editor with the full post-editor extension set. */
export function createPostEditor({
  content = "<p></p>",
  editable = true,
}: { content?: JSONContent | string; editable?: boolean } = {}) {
  return new HeadlessEditor({
    element: document.createElement("div"),
    extensions,
    content,
    editable,
  });
}

/** Fills in the browser APIs jsdom lacks that the editor's UI uses. */
export function installDomShims() {
  // Motion and mobile layout hooks read media queries.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
  // The editor's modals are <dialog> elements.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
  // The media library grid loads more as its end scrolls into view.
  window.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  // Popovers anchored to the selection measure text ranges; jsdom lays out
  // nothing, so every range is an empty rectangle at the origin.
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
  Range.prototype.getClientRects ??= () =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;
}

/**
 * Renders the post `Editor` component with the full extension set and
 * resolves with the editor instance once it is created. Call `cleanup` from
 * testing-library after each test.
 */
export async function renderPostEditor({
  content = "<p></p>",
  editable = true,
}: { content?: JSONContent | string; editable?: boolean } = {}) {
  installDomShims();
  let created: TiptapEditor | null = null;
  const view = await act(async () =>
    render(
      // The image picker's media library queries through React Query.
      createElement(
        QueryClientProvider,
        {
          client: new QueryClient({
            defaultOptions: { queries: { retry: false } },
          }),
        },
        createElement(Editor, {
          extensions,
          content,
          editable,
          onCreated: (editor) => {
            created = editor;
          },
        }),
      ),
    ),
  );
  // Tiptap reports creation on the next tick.
  const editor = await waitFor(() => {
    const current = created as TiptapEditor | null;
    if (!current) throw new Error("The editor was not created");
    return current;
  });
  return { ...view, editor };
}

/** Types `text` at the selection, one character at a time. */
export function typeText(editor: TiptapEditor, text: string) {
  for (const char of text) {
    const { view } = editor;
    const { from, to } = view.state.selection;
    const insert = () => view.state.tr.insertText(char, from, to);
    const handled = view.someProp("handleTextInput", (handle) =>
      handle(view, from, to, char, insert),
    );
    if (!handled) view.dispatch(insert());
  }
}

/** Presses a key in the editor; returns whether the editor handled it. */
export function pressKey(
  editor: TiptapEditor,
  key: string,
  init: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  editor.view.dom.dispatchEvent(event);
  return event.defaultPrevented;
}
