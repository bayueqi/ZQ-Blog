// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { findInPopover } from "tests/popover";
import { afterEach, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages";
import { PostsToolbar } from "./posts-toolbar";

vi.mock("@/hooks/use-motion", () => ({
  MOTION: { popover: 120 },
  useMotionPresence: (open: boolean) => open,
}));
vi.mock("@/lib/orpc", async () => {
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    orpc: createTanstackQueryUtils({
      categories: {
        list: async () => [],
        admin: { options: async () => [{ id: 2, name: "Notes" }] },
      },
      tags: {
        list: async () => [],
        admin: { list: async () => [{ id: 5, name: "Rust" }] },
      },
    }),
  };
});

afterEach(cleanup);

function renderToolbar(filters: { category?: number | "none"; tag?: number }) {
  const onCategoryChange = vi.fn();
  const onTagChange = vi.fn();
  const onManageTaxonomy = vi.fn();
  render(
    createElement(
      QueryClientProvider,
      {
        client: new QueryClient({
          defaultOptions: { queries: { retry: false } },
        }),
      },
      createElement(PostsToolbar, {
        searchTerm: "",
        onSearchChange: vi.fn(),
        searchRef: null,
        status: "ALL",
        onStatusChange: vi.fn(),
        sortBy: "updatedAt",
        onSortByChange: vi.fn(),
        onCategoryChange,
        onTagChange,
        onManageTaxonomy,
        ...filters,
      }),
    ),
  );
  return { onCategoryChange, onTagChange, onManageTaxonomy };
}

async function pick(menu: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: menu }));
  fireEvent.click(await findInPopover("menuitemradio", { name: option }));
}

it("filters by a category, by uncategorized posts and by a tag", async () => {
  const { onCategoryChange, onTagChange } = renderToolbar({});
  await screen.findByText(m.admin_posts_filter_category_all());

  await pick(m.admin_posts_filter_category(), "Notes");
  expect(onCategoryChange).toHaveBeenLastCalledWith(2);
  await pick(m.admin_posts_filter_category(), m.post_uncategorized());
  expect(onCategoryChange).toHaveBeenLastCalledWith("none");
  await pick(m.admin_posts_filter_tag(), "Rust");
  expect(onTagChange).toHaveBeenLastCalledWith(5);
});

it("shows the chosen filters and clears them through the all options", async () => {
  const { onCategoryChange, onTagChange } = renderToolbar({
    category: 2,
    tag: 5,
  });
  await screen.findByText("Notes");
  await screen.findByText("Rust");

  await pick(
    m.admin_posts_filter_category(),
    m.admin_posts_filter_category_all(),
  );
  expect(onCategoryChange).toHaveBeenLastCalledWith(undefined);
  await pick(m.admin_posts_filter_tag(), m.admin_posts_filter_tag_all());
  expect(onTagChange).toHaveBeenLastCalledWith(undefined);
});

it("drops a filter whose category or tag no longer exists without a history entry", async () => {
  const stale = renderToolbar({ category: 99 });
  await waitFor(() =>
    expect(stale.onCategoryChange).toHaveBeenCalledWith(undefined, true),
  );
  cleanup();
  const staleTag = renderToolbar({ tag: 99 });
  await waitFor(() =>
    expect(staleTag.onTagChange).toHaveBeenCalledWith(undefined, true),
  );
  expect(staleTag.onCategoryChange).not.toHaveBeenCalled();
});

it("opens the categories and tags sheet from beside the filters", () => {
  const { onManageTaxonomy } = renderToolbar({});
  const manage = screen.getByRole("button", {
    name: m.admin_posts_manage_taxonomy(),
  });
  expect(manage.getAttribute("aria-haspopup")).toBe("dialog");
  expect(manage.previousElementSibling?.textContent).toContain(
    m.admin_posts_filter_tag_all(),
  );
  fireEvent.click(manage);
  expect(onManageTaxonomy).toHaveBeenCalledOnce();
});
