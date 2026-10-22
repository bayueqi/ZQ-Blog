import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rawHttpsGet } from "@/lib/http/raw-https";
import { fetchVideoMeta } from "./video-meta.service";

// The socket API only exists in workerd.
vi.mock("@/lib/http/raw-https", () => ({ rawHttpsGet: vi.fn() }));

const VIDEO = {
  provider: "bilibili",
  videoId: "BV1fK4y1s7Qf",
  page: null,
  start: null,
} as const;

const socketGet = vi.mocked(rawHttpsGet);

/** Bilibili answers `body` over the socket with `status`. */
function bilibiliAnswers(body: unknown, status = 200) {
  socketGet.mockResolvedValue({
    status,
    headers: {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function warnings(): Array<Record<string, unknown>> {
  return vi
    .mocked(console.warn)
    .mock.calls.map((call) => JSON.parse(String(call[0])));
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  socketGet.mockReset();
});

it("asks Bilibili over a socket by BV ID, without a browser User-Agent", async () => {
  bilibiliAnswers({ code: 0, data: { title: "t" } });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await fetchVideoMeta(VIDEO);

  const [url, headers] = socketGet.mock.calls[0];
  expect(url.toString()).toBe(
    "https://api.bilibili.com/x/web-interface/view?bvid=BV1fK4y1s7Qf",
  );
  expect(
    Object.keys(headers ?? {}).map((name) => name.toLowerCase()),
  ).not.toContain("user-agent");
  // Workers' fetch() carries cf-* headers that Bilibili refuses.
  expect(fetch).not.toHaveBeenCalled();
});

it("asks by aid for an av ID", async () => {
  bilibiliAnswers({ code: 0, data: { title: "t" } });
  await fetchVideoMeta({ ...VIDEO, videoId: "av170001" });
  expect(String(socketGet.mock.calls[0]?.[0])).toBe(
    "https://api.bilibili.com/x/web-interface/view?aid=170001",
  );
});

it("returns the title, the cover over HTTPS, and the part's own length", async () => {
  bilibiliAnswers({
    code: 0,
    data: {
      title: "稻葉曇『ラグトレイン』",
      pic: "http://i2.hdslb.com/bfs/archive/81192e94.jpg",
      duration: 600,
      pages: [
        { page: 1, duration: 252 },
        { page: 2, duration: 348 },
      ],
    },
  });
  expect(await fetchVideoMeta({ ...VIDEO, page: 2 })).toEqual({
    title: "稻葉曇『ラグトレイン』",
    cover: "https://i2.hdslb.com/bfs/archive/81192e94.jpg",
    duration: 348,
  });
});

it("drops a cover that is not on Bilibili's image CDN", async () => {
  bilibiliAnswers({
    code: 0,
    data: { title: "t", pic: "https://evil.example/bfs/x.jpg", duration: 5 },
  });
  expect(await fetchVideoMeta(VIDEO)).toEqual({
    title: "t",
    cover: null,
    duration: 5,
  });
});

it("returns null and logs why when Bilibili refuses, errors or cannot be reached", async () => {
  bilibiliAnswers({ code: -404, message: "啥都木有" });
  expect(await fetchVideoMeta(VIDEO)).toBeNull();
  expect(warnings().at(-1)).toMatchObject({ code: -404 });

  bilibiliAnswers('{"code":-412,"message":"request was banned"}', 412);
  expect(await fetchVideoMeta(VIDEO)).toBeNull();
  expect(warnings().at(-1)).toMatchObject({
    message: "video meta lookup failed",
    host: "api.bilibili.com",
    status: 412,
  });

  bilibiliAnswers("<html>not json</html>");
  expect(await fetchVideoMeta(VIDEO)).toBeNull();

  socketGet.mockRejectedValue(new Error("Timed out after 8000 ms"));
  expect(await fetchVideoMeta(VIDEO)).toBeNull();
  expect(warnings().at(-1)).toMatchObject({
    error: "Timed out after 8000 ms",
  });
});

it("asks YouTube's oEmbed endpoint for the title only, over fetch", async () => {
  const fetch = vi.fn(async (_url: URL, _init?: RequestInit) =>
    Response.json({
      title: "ふわり feat.MIMI",
      thumbnail_url: "https://i.ytimg.com/vi/5gIf0_xpFPI/hqdefault.jpg",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(
    await fetchVideoMeta({
      provider: "youtube",
      videoId: "5gIf0_xpFPI",
      page: null,
      start: 30,
    }),
  ).toEqual({ title: "ふわり feat.MIMI", cover: null, duration: null });
  expect(String(fetch.mock.calls[0]?.[0])).toBe(
    "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D5gIf0_xpFPI&format=json",
  );
  expect(socketGet).not.toHaveBeenCalled();
});

it("returns null for a YouTube video oEmbed does not know", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "Bad Request" }, { status: 400 })),
  );
  expect(
    await fetchVideoMeta({
      provider: "youtube",
      videoId: "aaaaaaaaaaa",
      page: null,
      start: null,
    }),
  ).toBeNull();
});
