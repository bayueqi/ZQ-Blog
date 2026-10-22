// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createElement, useState } from "react";
import { findInPopover } from "tests/popover";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { categoriesAdminQueryOptions, categoryOptionsQuery } from "../queries";
import { PostEditorSummary } from "@/features/posts/components/post-editor/post-editor-summary";
import type { orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";
import { CategorySelect } from "./category-select";

const requests = vi.hoisted(() => ({
  options: vi.fn<() => Promise<Array<{ id: number; name: string }>>>(),
  adminList: vi.fn<typeof orpcClient.categories.admin.list>(),
  create: vi.fn<typeof orpcClient.categories.admin.create>(),
}));
vi.mock("@/lib/orpc", async () => {
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    orpc: createTanstackQueryUtils({
      categories: {
        list: async () => [],
        admin: { options: requests.options, list: requests.adminList },
      },
      tags: { list: async () => [], admin: { list: async () => [] } },
      posts: { list: async () => [], admin: { list: async () => [] } },
    }),
    orpcClient: { categories: { admin: { create: requests.create } } },
  };
});

let queryClient: QueryClient;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

it("uses lightweight options for selection and summary without replacing the management count cache", async () => {
  requests.options.mockResolvedValue([
    { id: 2, name: "Alpha new" },
    { id: 1, name: "Zeta unused" },
  ]);
  const management = {
    items: [],
    uncategorizedPostCount: 5,
    uncategorizedPublicPostCount: 3,
  };
  requests.adminList.mockResolvedValue(management);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(categoriesAdminQueryOptions().queryKey, management);
  function EditorCategory() {
    const [categoryId, setCategoryId] = useState<number | null>(2);
    return createElement(
      "div",
      null,
      createElement(CategorySelect, {
        value: categoryId,
        onChange: setCategoryId,
      }),
      createElement(PostEditorSummary, {
        categoryId,
        tagIds: [],
        hasCover: false,
        onOpenInfo: () => {},
      }),
    );
  }
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(EditorCategory),
    ),
  );
  const picker = await screen.findByRole("button", { name: "Alpha new" });
  const summary = screen.getByRole("button", { name: m.editor_info_title() });
  expect(within(summary).getByText("Alpha new")).toBeDefined();
  expect(categoryOptionsQuery.queryKey).not.toEqual(
    categoriesAdminQueryOptions().queryKey,
  );
  expect(
    queryClient.getQueryData(categoriesAdminQueryOptions().queryKey),
  ).toEqual(management);
  expect(requests.adminList).not.toHaveBeenCalled();

  await act(async () => fireEvent.click(picker));
  fireEvent.click(await findInPopover("option", { name: "Zeta unused" }));
  expect(within(summary).getByText("Zeta unused")).toBeDefined();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Zeta unused" })),
  );
  fireEvent.click(
    await findInPopover("option", { name: m.editor_meta_uncategorized() }),
  );
  expect(
    within(summary).getByText(m.editor_meta_uncategorized()),
  ).toBeDefined();
});

it("creates a category from the picker and selects it", async () => {
  const options = [{ id: 1, name: "Zeta" }];
  requests.options.mockImplementation(async () => options);
  requests.create.mockImplementation(async ({ name }) => {
    const created = { id: 3, name };
    options.push(created);
    return { ...created, createdAt: new Date(), updatedAt: new Date() };
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onChange = vi.fn();
  function EditorCategory() {
    const [categoryId, setCategoryId] = useState<number | null>(null);
    return createElement(CategorySelect, {
      value: categoryId,
      onChange: (next) => {
        onChange(next);
        setCategoryId(next);
      },
    });
  }
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(EditorCategory),
    ),
  );
  const picker = await screen.findByRole("button", {
    name: m.editor_meta_uncategorized(),
  });
  await waitFor(() => expect(picker.hasAttribute("disabled")).toBe(false));
  await act(async () => fireEvent.click(picker));
  fireEvent.click(
    await findInPopover("option", { name: m.editor_meta_category_create() }),
  );
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole("textbox", { name: m.taxonomy_manager_create_category() }),
    { target: { value: " Rust notes " } },
  );
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: m.category_manager_create() }),
    ),
  );
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(3));
  expect(requests.create.mock.calls[0]?.[0]).toEqual({ name: "Rust notes" });
  expect(
    await screen.findByRole("button", { name: "Rust notes" }),
  ).toBeDefined();
});
