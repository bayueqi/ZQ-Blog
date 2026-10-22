import type {
  VideoMeta,
  VideoSource,
} from "@/features/posts/utils/video-source";
import { videoMetaOf, videoPageUrl } from "@/features/posts/utils/video-source";
import { rawHttpsGet } from "@/lib/http/raw-https";

const BILIBILI_VIEW = "https://api.bilibili.com/x/web-interface/view";
const YOUTUBE_OEMBED = "https://www.youtube.com/oembed";

interface BilibiliView {
  code: number;
  message?: unknown;
  data?: {
    title?: unknown;
    pic?: unknown;
    duration?: unknown;
    pages?: Array<{ page?: unknown; duration?: unknown }>;
  };
}

function warnLookupFailed(url: URL, detail: Record<string, unknown>) {
  console.warn(
    JSON.stringify({
      message: "video meta lookup failed",
      host: url.hostname,
      ...detail,
    }),
  );
}

/**
 * `url`'s JSON body, or `null` when it fails, is not OK or is not JSON; the
 * reason is logged, since providers refuse some servers.
 */
async function getJson(url: URL): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) return await response.json();
    const body = await response.text().catch(() => "");
    warnLookupFailed(url, {
      status: response.status,
      body: body.slice(0, 200),
    });
    return null;
  } catch (error) {
    warnLookupFailed(url, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Bilibili's video info endpoint is public but undocumented. It refuses
 * Workers' `fetch()` outright (412 "request was banned", for the cf-* headers
 * fetch adds), so the request goes over a plain socket, and it refuses a
 * browser-like User-Agent without Bilibili's cookies, so it sends none.
 */
async function fetchBilibiliMeta(source: VideoSource) {
  const url = new URL(BILIBILI_VIEW);
  const av = /^av(\d+)$/i.exec(source.videoId);
  if (av) url.searchParams.set("aid", av[1]);
  else url.searchParams.set("bvid", source.videoId);

  let body: BilibiliView;
  try {
    const response = await rawHttpsGet(url, { Accept: "application/json" });
    if (response.status !== 200) {
      warnLookupFailed(url, {
        status: response.status,
        body: response.body.slice(0, 200),
      });
      return null;
    }
    body = JSON.parse(response.body) as BilibiliView;
  } catch (error) {
    warnLookupFailed(url, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  if (body.code !== 0 || !body.data) {
    warnLookupFailed(url, { code: body.code, body: body.message });
    return null;
  }
  const { data } = body;
  // A part of a multi-part video has a length of its own.
  const part = data.pages?.find((page) => page.page === (source.page ?? 1));
  return videoMetaOf({
    title: data.title,
    cover: data.pic,
    duration: part?.duration ?? data.duration,
  });
}

/**
 * YouTube's oEmbed endpoint gives the title only; the thumbnail has a fixed
 * URL already, and the length is not public without an API key.
 */
async function fetchYoutubeMeta(source: VideoSource) {
  const url = new URL(YOUTUBE_OEMBED);
  url.searchParams.set("url", videoPageUrl({ ...source, start: null }));
  url.searchParams.set("format", "json");
  const body = (await getJson(url)) as { title?: unknown } | null;
  return body ? videoMetaOf({ title: body.title }) : null;
}

/**
 * The title, cover and length of `source` as far as its provider tells, or
 * `null` when it tells nothing or cannot be reached.
 */
export async function fetchVideoMeta(
  source: VideoSource,
): Promise<VideoMeta | null> {
  const meta =
    source.provider === "bilibili"
      ? await fetchBilibiliMeta(source)
      : await fetchYoutubeMeta(source);
  return meta?.title || meta?.cover ? meta : null;
}
