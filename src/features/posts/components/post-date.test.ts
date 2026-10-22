import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { PostItem } from "../schema/posts.schema";
import { formatPublicPostDate } from "../utils/format-public-post-date";
import { PostCard } from "./post-card";
import { Footer } from "@/components/layout/footer";
import { PostMeta } from "./post-meta";
import { ArchivePost } from "./archive/archive-post";

vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual("@tanstack/react-router")),
  useLoaderData: () => ({ currentYear: 2026 }),
  useRouteContext: () => ({ siteConfig: { author: "Test author" } }),
  Link: ({ children }: { children: ReactNode }) =>
    createElement("a", null, children),
}));
vi.mock("@/paraglide/runtime", async () => ({
  ...(await vi.importActual("@/paraglide/runtime")),
  getLocale: () => "en",
}));

const originalTZ = process.env.TZ;
afterEach(() => {
  vi.useRealTimers();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
const post = {
  id: 1,
  title: "SSR date",
  slug: "ssr-date",
  summary: "",
  tags: [],
  category: null,
  cover: null,
  publishedAt: new Date("2026-12-31T23:30:00Z"),
  updatedAt: new Date("2027-01-01T00:30:00Z"),
  readTimeInMinutes: 1,
} as unknown as PostItem;

it("renders the final publication date in the PostCard's server HTML", () => {
  const html = renderToString(createElement(PostCard, { post }));
  expect(html.match(/<time[^>]*>(.*?)<\/time>/)?.[1]).toBe("12/31/2026");
});
it("renders public post metadata and archive dates on the server", () => {
  expect(renderToString(createElement(PostMeta, { post }))).toContain(
    "12/31/2026",
  );
  expect(renderToString(createElement(PostMeta, { post }))).toContain(
    "01/01/2027",
  );
  expect(renderToString(createElement(ArchivePost, { post }))).toContain(
    "12/31",
  );
});
it("keeps server and visitor dates identical across timezone and year boundaries", () => {
  const render = () => [
    renderToString(createElement(PostCard, { post })),
    renderToString(createElement(PostMeta, { post })),
    renderToString(createElement(ArchivePost, { post })),
  ];
  process.env.TZ = "UTC";
  const server = render();
  process.env.TZ = "Pacific/Kiritimati";
  expect(render()).toEqual(server);
  process.env.TZ = "America/Los_Angeles";
  expect(render()).toEqual(server);
  expect(server[0]).toContain("12/31/2026");
});

it("keeps both localized public date styles and missing-date behavior", () => {
  expect(formatPublicPostDate(post.publishedAt, { locale: "zh" })).toBe(
    "2026年12月31日",
  );
  expect(
    formatPublicPostDate(post.publishedAt, { locale: "en", monthDay: true }),
  ).toBe("12/31");
  expect(formatPublicPostDate(null)).toBe("-");
  expect(formatPublicPostDate("invalid")).toBe("-");
});

it("renders the footer copyright using the serialized server year even across New Year", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-01-01T00:00:01Z"));
  const html = renderToString(createElement(Footer, { navOptions: [] }));
  expect(html).toContain("2026");
  expect(html).toContain("Test author");
  expect(html).not.toContain("2027");
});
