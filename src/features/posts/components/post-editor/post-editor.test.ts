// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminChromeProvider } from "@/components/admin/admin-chrome";
import { installDomShims } from "@/features/posts/editor/test-utils";
import { PostEditor } from ".";
import type { PostEditorData, PostEditorProps } from "./types";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) =>
    createElement("a", null, children),
  useBlocker: () => ({ status: "idle", proceed: vi.fn(), reset: vi.fn() }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/use-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-motion")>()),
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

const INITIAL: PostEditorProps["initialData"] = {
  id: 1,
  title: "Post",
  summary: "",
  slug: "post",
  contentJson: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "intro" }] },
      { type: "paragraph" },
    ],
  },
  publishedAt: null,
  pinnedAt: null,
  tagIds: [],
  categoryId: null,
  hasPublicSnapshot: false,
  serverToday: "2026-10-05",
  coverMediaId: null,
  cover: null,
  visibility: "public",
  hasAccessPassword: false,
};

async function renderPostEditorPage(onSave: PostEditorProps["onSave"]) {
  installDomShims();
  render(
    createElement(
      QueryClientProvider,
      {
        client: new QueryClient({
          defaultOptions: { queries: { retry: false } },
        }),
      },
      createElement(
        AdminChromeProvider,
        null,
        createElement(PostEditor, {
          initialData: INITIAL,
          publicSlug: null,
          onSave,
        }),
      ),
    ),
  );
  return waitFor(() => {
    const dom = document.querySelector<HTMLElement & { editor?: Editor }>(
      ".ProseMirror",
    );
    if (!dom?.editor) throw new Error("The editor was not created");
    return dom.editor;
  });
}

it("saves the post without an unfilled image placeholder", async () => {
  const onSave = vi.fn<(data: PostEditorData) => Promise<void>>(async () => {});
  const editor = await renderPostEditorPage(onSave);

  act(() => {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertImagePlaceholder();
  });
  expect(JSON.stringify(editor.getJSON())).toContain("imagePlaceholder");

  await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 4000 });
  const saved = onSave.mock.lastCall?.[0].contentJson;
  expect(JSON.stringify(saved)).not.toContain("imagePlaceholder");
  expect(saved?.content?.[0]).toEqual(INITIAL.contentJson?.content?.[0]);
});
