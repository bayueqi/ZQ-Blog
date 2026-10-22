// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Categories } from "@/features/categories/components/category-cloud";
import { categoriesQueryOptions } from "@/features/categories/queries";
import { Tags } from "@/features/tags/components/tag-cloud";
import { tagsQueryOptions } from "@/features/tags/queries";
import { m } from "@/paraglide/messages";

vi.mock("@/features/categories/queries", () => ({
  categoriesQueryOptions: {
    queryKey: ["sidebar-categories"],
    staleTime: Infinity,
  },
}));
vi.mock("@/features/tags/queries", () => ({
  tagsQueryOptions: {
    queryKey: ["sidebar-tags"],
    staleTime: Infinity,
  },
}));

let queryClient: QueryClient;

afterEach(() => {
  cleanup();
  queryClient.clear();
});

it.each([
  {
    name: "Categories",
    Component: Categories,
    queryKey: categoriesQueryOptions.queryKey,
    threshold: 5,
    filter: "categoryName",
  },
  {
    name: "Tags",
    Component: Tags,
    queryKey: tagsQueryOptions.queryKey,
    threshold: 20,
    filter: "tagName",
  },
])(
  "preserves $name filters, collapse threshold, and expansion across empty results",
  async ({ Component, queryKey, threshold, filter }) => {
    queryClient = new QueryClient();
    queryClient.setQueryData<unknown>(queryKey, []);
    const root = createRootRoute();
    const index = createRoute({
      getParentRoute: () => root,
      path: "/",
      component: Component,
    });
    const posts = createRoute({ getParentRoute: () => root, path: "/posts" });
    const router = createRouter({
      routeTree: root.addChildren([index, posts]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(RouterProvider, { router }),
        ),
      );
      await router.load();
    });
    expect(view.container.childElementCount).toBe(0);

    async function updateItems(count: number) {
      await act(async () => {
        queryClient.setQueryData<unknown>(
          queryKey,
          Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            name: `Entry ${index + 1}`,
            postCount: index + 3,
            createdAt: new Date(0),
          })),
        );
      });
      await waitFor(() => {
        expect(screen.queryAllByRole("link")).toHaveLength(count);
      });
    }

    await updateItems(threshold - 1);
    expect(screen.queryByRole("button", { name: m.widget_more() })).toBeNull();
    const firstLink = screen.getAllByRole("link")[0];
    const target = new URL(
      firstLink.getAttribute("href")!,
      "https://example.com",
    );
    expect(target.pathname).toBe("/posts");
    expect(Array.from(target.searchParams.entries())).toEqual([
      [filter, "Entry 1"],
    ]);
    if (filter === "categoryName") {
      expect(firstLink.textContent).toBe("Entry 13");
    } else {
      expect(firstLink.textContent).toBe("Entry 1");
    }
    const content = firstLink.parentElement!;
    expect(content.style.height).toBe("");

    await updateItems(threshold);
    expect(content.style.height).toBe("7.5rem");
    fireEvent.click(screen.getByRole("button", { name: m.widget_more() }));
    expect(content.style.height).toBe("");
    expect(screen.queryByRole("button", { name: m.widget_more() })).toBeNull();

    await updateItems(0);
    expect(view.container.childElementCount).toBe(0);
    await updateItems(threshold);
    expect(screen.getAllByRole("link")[0].parentElement!.style.height).toBe("");
    expect(screen.queryByRole("button", { name: m.widget_more() })).toBeNull();
  },
);
