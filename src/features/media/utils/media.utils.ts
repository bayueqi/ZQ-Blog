export function getContentTypeFromKey(key: string): string | undefined {
  const extension = key.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return contentTypes[extension || ""];
}

export function generateKey(fileName: string): string {
  const uuid = crypto.randomUUID();
  const extension = fileName.split(".").pop()?.toLowerCase() || "bin";

  return `${uuid}.${extension}`;
}

/**
 * 从图片 URL 中提取 R2 key
 * 支持格式：
 * - /images/${key}
 * - /images/${key}?quality=80&format=webp
 * - https://domain.com/images/${key}?quality=80
 */
export function extractImageKey(src: string): string | undefined {
  if (!src) return undefined;

  const prefix = "/images/";
  let pathname = "";

  try {
    // 尝试解析为 URL
    const url = new URL(src, "http://dummy.com"); // 传入 base 确保相对路径也能被解析
    pathname = url.pathname;
  } catch {
    // 极少数情况解析失败，手动截断 query
    pathname = src.split("?")[0];
  }

  if (pathname.startsWith(prefix)) {
    return pathname.replace(prefix, "");
  }
  return undefined;
}

/**
 * 生成优化后的图片 URL
 * @param key - R2 key
 * @param width - 可选的宽度限制
 */
export function isGifKey(key: string, contentType?: string | null) {
  return key.toLowerCase().endsWith(".gif") || contentType === "image/gif";
}

export const PUBLIC_IMAGE_WIDTH = {
  banner: 1600,
  cover: 800,
  body: 800,
  avatar: 400,
  // The lightbox; Cloudflare never upscales, so smaller originals keep their size.
  zoom: 2560,
} as const;

export function getOriginalImageUrl(key: string) {
  return `/images/${key}`;
}

/**
 * The original an image transform reads. It carries the request's `v` so a
 * replaced file at the same key is fetched fresh instead of from the edge
 * cache of the unversioned original.
 */
export function getTransformSourceUrl(requestUrl: URL, key: string) {
  const source = new URL(getOriginalImageUrl(key), requestUrl.origin);
  source.searchParams.set("original", "true");
  const version = requestUrl.searchParams.get("v");
  if (version) source.searchParams.set("v", version);
  return source.toString();
}

export function getOptimizedImageUrl(key: string, width?: number) {
  if (isGifKey(key)) {
    return `/images/${key}?original=true`;
  }
  return `/images/${key}?quality=80${width ? `&width=${width}` : ""}`;
}

/** A `srcset` of transformed widths, or undefined when the image is not transformed. */
export function getPublicImageSrcSet(
  src: string,
  widths: ReadonlyArray<number>,
) {
  const key = extractImageKey(src);
  if (!key || isGifKey(key)) return undefined;
  return widths
    .map((width) => `${getPublicImageSrc(src, width)} ${width}w`)
    .join(", ");
}

export function getPublicImageSrc(src: string, width: number) {
  const key = extractImageKey(src);
  if (!key) return src;
  const version = new URL(src, "http://dummy.com").searchParams.get("v");
  const optimized = getOptimizedImageUrl(key, width);
  if (!version) return optimized;
  const next = new URL(optimized, "http://dummy.com");
  next.searchParams.set("v", version);
  return `${next.pathname}${next.search}`;
}

// Cloudflare bills each image and parameter set once a month, so only the
// widths the site requests are transformed. Anything else gets the original,
// which keeps arbitrary parameters from using up the transformation quota.
export const IMAGE_TRANSFORM_WIDTHS = [400, 800, 1600, 2560] as const;
const IMAGE_TRANSFORM_QUALITY = 80;
const IMAGE_TRANSFORM_PARAMS = new Set(["width", "quality", "v"]);

/**
 * The Cloudflare transform for a public image request, or null to serve the
 * original. Only an allowed width at the site's quality is transformed.
 */
export function parseImageTransform(
  searchParams: URLSearchParams,
  accept: string,
) {
  for (const name of searchParams.keys()) {
    if (!IMAGE_TRANSFORM_PARAMS.has(name)) return null;
  }
  const width = Number(searchParams.get("width"));
  if (!IMAGE_TRANSFORM_WIDTHS.some((allowed) => allowed === width)) return null;
  const quality = searchParams.get("quality");
  if (quality !== null && Number(quality) !== IMAGE_TRANSFORM_QUALITY) {
    return null;
  }

  const format: "avif" | "webp" | undefined = /image\/avif/.test(accept)
    ? "avif"
    : /image\/webp/.test(accept)
      ? "webp"
      : undefined;
  return {
    width,
    quality: IMAGE_TRANSFORM_QUALITY,
    ...(format ? { format } : {}),
  };
}
