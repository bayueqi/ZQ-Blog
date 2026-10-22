import { describe, expect, it } from "vitest";
import { isVisitor, parseUserAgent } from "./visit-agent";
import { buildVisitorStats, lastUtcDays, type VisitRow } from "./visits";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

describe("parseUserAgent", () => {
  it("tells Edge from the Chrome it claims to be", () => {
    expect(parseUserAgent(EDGE_WINDOWS)).toEqual({
      browser: "Edge",
      device: "desktop",
      os: "Windows",
    });
    expect(parseUserAgent(CHROME_WINDOWS).browser).toBe("Chrome");
  });

  it("reads iOS off the iPhone before the Mac OS X it also names", () => {
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({
      browser: "Safari",
      device: "mobile",
      os: "iOS",
    });
    expect(parseUserAgent(SAFARI_MAC)).toMatchObject({
      device: "desktop",
      os: "macOS",
    });
  });

  it("counts an iPad as a tablet and an Android phone as mobile", () => {
    expect(parseUserAgent(SAFARI_IPAD)).toMatchObject({
      device: "tablet",
      os: "iOS",
    });
    expect(parseUserAgent(CHROME_ANDROID)).toMatchObject({
      device: "mobile",
      os: "Android",
    });
  });

  it("falls back to Other for a browser it does not know", () => {
    expect(parseUserAgent(FIREFOX_LINUX)).toEqual({
      browser: "Firefox",
      device: "desktop",
      os: "Linux",
    });
    expect(parseUserAgent("SomethingElse/1.0").browser).toBe("Other");
  });
});

describe("isVisitor", () => {
  it("drops crawlers and tools", () => {
    expect(isVisitor("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(false);
    expect(isVisitor("curl/8.4.0")).toBe(false);
    expect(isVisitor("")).toBe(false);
    expect(isVisitor(null)).toBe(false);
  });

  it("keeps a real browser", () => {
    expect(isVisitor(CHROME_WINDOWS)).toBe(true);
  });
});

function row(overrides: Partial<VisitRow>): VisitRow {
  return {
    day: "2026-10-22",
    country: "CN",
    browser: "Chrome",
    device: "desktop",
    os: "Windows",
    views: 1,
    ...overrides,
  };
}

describe("buildVisitorStats", () => {
  const today = new Date("2026-10-22T05:00:00Z");
  const rows: Array<VisitRow> = [
    row({ views: 5 }),
    row({ day: "2026-10-21", views: 3 }),
    row({
      day: "2026-10-21",
      country: "US",
      browser: "Safari",
      device: "mobile",
      os: "iOS",
      views: 2,
    }),
    // 早于窗口，不该算进来。
    row({ day: "2026-10-10", browser: "Edge", views: 9 }),
  ];

  it("covers seven UTC days ending today", () => {
    const stats = buildVisitorStats(rows, today);
    expect(stats.days).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
    expect(stats.total).toBe(10);
  });

  it("ranks each dimension by views and lines up the daily series", () => {
    const stats = buildVisitorStats(rows, today);
    const browser = stats.dimensions.find((item) => item.key === "browser");
    expect(browser?.items.map((item) => [item.label, item.views])).toEqual([
      ["Chrome", 8],
      ["Safari", 2],
    ]);
    expect(browser?.items[0]?.daily).toEqual([0, 0, 0, 0, 0, 3, 5]);
  });

  it("keeps the top five and leaves the rest in the total", () => {
    const many = ["Chrome", "Safari", "Edge", "Firefox", "Opera", "Other"].map(
      (browser, index) => row({ browser, views: index + 1 }),
    );
    const stats = buildVisitorStats(many, today);
    const browser = stats.dimensions.find((item) => item.key === "browser");
    expect(browser?.items).toHaveLength(5);
    expect(browser?.items[0]?.label).toBe("Other");
    expect(stats.total).toBe(21);
  });

  it("is empty rather than undefined without any rows", () => {
    const stats = buildVisitorStats([], today);
    expect(stats.total).toBe(0);
    expect(stats.dimensions.map((item) => item.items)).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });
});

describe("lastUtcDays", () => {
  it("keeps the UTC day across a local evening", () => {
    expect(lastUtcDays(new Date("2026-10-22T23:30:00Z"), 2)).toEqual([
      "2026-10-21",
      "2026-10-22",
    ]);
  });
});
