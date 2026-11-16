import * as MediaRepo from "@/features/media/data/media.data";
import * as Storage from "@/features/media/data/media.storage";
import type {
  GetMediaListInput,
  UpdateMediaNameInput,
} from "@/features/media/media.schema";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from "@/features/media/media.schema";
import { getImageDimensions } from "@/features/media/utils/image-dimensions";
import {
  getContentTypeFromKey,
  getOriginalImageUrl,
  getTransformSourceUrl,
  parseImageTransform,
  isGifKey,
  isVideoKey,
  isVideoMime,
} from "@/features/media/utils/media.utils";
import * as PostMediaRepo from "@/features/posts/data/post-media.data";
import { CACHE_CONTROL } from "@/lib/constants";
import { err, ok } from "@/lib/errors";

export async function upload(
  context: DbContext & { executionCtx: ExecutionContext },
  input: { file: File },
) {
  const { file } = input;

  // 视频没有可取的长宽，也不该为了读尺寸把整段文件拉进内存。
  const dimensions = isVideoMime(file.type)
    ? null
    : getImageDimensions(await file.arrayBuffer());
  const width = dimensions?.width;
  const height = dimensions?.height;

  const uploaded = await Storage.putToR2(context.env, file);

  try {
    const mediaRecord = await MediaRepo.insertMedia(context.db, {
      key: uploaded.key,
      url: uploaded.url,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeInBytes: uploaded.sizeInBytes,
      width,
      height,
    });
    return ok(mediaRecord);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "media db insert failed, rolling back r2 upload",
        key: uploaded.key,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    context.executionCtx.waitUntil(
      Storage.deleteFromR2(context.env, uploaded.key).catch((rollbackError) =>
        console.error(
          JSON.stringify({
            message: "r2 rollback delete failed",
            key: uploaded.key,
            error:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          }),
        ),
      ),
    );
    return err({ reason: "MEDIA_RECORD_CREATE_FAILED" });
  }
}

export async function deleteImage(
  context: DbContext & { executionCtx: ExecutionContext },
  key: string,
) {
  // 后端兜底检查：文章、管理员头像、相册集、日常都算引用，被引用的不许删，
  // 否则文章裂图，相册里的照片会被级联删掉，日常里的图也会空掉。
  const inUse =
    (await PostMediaRepo.isMediaInUse(context.db, key)) ||
    (await MediaRepo.isUsedAsAdminAvatar(context.db, key)) ||
    (await MediaRepo.isUsedInGallery(context.db, key)) ||
    (await MediaRepo.isUsedInMoments(context.db, key));
  if (inUse) {
    return err({ reason: "MEDIA_IN_USE" });
  }

  await MediaRepo.deleteMedia(context.db, key);
  context.executionCtx.waitUntil(
    Storage.deleteFromR2(context.env, key).catch((deleteError) =>
      console.error(
        JSON.stringify({
          message: "r2 delete failed",
          key,
          error:
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError),
        }),
      ),
    ),
  );

  return ok({ success: true });
}

export async function getMediaList(
  context: DbContext,
  data: GetMediaListInput,
) {
  return await MediaRepo.getMediaList(context.db, data);
}

export async function isMediaInUse(context: DbContext, key: string) {
  return await PostMediaRepo.isMediaInUse(context.db, key);
}

export async function getLinkedPosts(context: DbContext, key: string) {
  return await PostMediaRepo.getPostsByMediaKey(context.db, key);
}

export async function getLinkedGalleries(context: DbContext, key: string) {
  return await MediaRepo.getGalleriesByMediaKey(context.db, key);
}

export async function getLinkedMoments(context: DbContext, key: string) {
  return await MediaRepo.getMomentsByMediaKey(context.db, key);
}

export async function getLinkedMediaKeys(
  context: DbContext,
  keys: Array<string>,
) {
  return await PostMediaRepo.getLinkedMediaKeys(context.db, keys);
}

export async function getTotalMediaSize(context: DbContext) {
  return await MediaRepo.getTotalMediaSize(context.db);
}

export async function getMediaStats(context: DbContext) {
  return await MediaRepo.getMediaStats(context.db);
}

export async function updateMediaName(
  context: DbContext,
  data: UpdateMediaNameInput,
) {
  return await MediaRepo.updateMediaName(context.db, data.key, data.name);
}

export async function replaceImage(
  context: DbContext,
  input: { key: string; file: File },
) {
  const existing = await MediaRepo.findMediaByKey(context.db, input.key);
  if (!existing) {
    return err({ reason: "MEDIA_NOT_FOUND" });
  }

  const dimensions = getImageDimensions(await input.file.arrayBuffer());
  await Storage.putToR2(context.env, input.file, input.key);
  // The key stays, so a new version keeps cached copies of the old file from
  // answering for the new one.
  const url = `${getOriginalImageUrl(input.key)}?v=${Date.now()}`;
  const updated = await MediaRepo.updateMediaFile(context.db, input.key, {
    url,
    fileName: input.file.name || existing.fileName,
    mimeType: input.file.type || existing.mimeType,
    sizeInBytes: input.file.size,
    width: dimensions?.width,
    height: dimensions?.height,
  });
  if (!updated) {
    return err({ reason: "MEDIA_NOT_FOUND" });
  }
  await PostMediaRepo.pointDraftImagesAt(context.db, existing, url);
  return ok(updated);
}

export async function deleteUnused(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const keys = await MediaRepo.deleteUnusedMedia(context.db);
  for (const key of keys) {
    context.executionCtx.waitUntil(
      Storage.deleteFromR2(context.env, key).catch((deleteError) =>
        console.error(
          JSON.stringify({
            message: "r2 delete failed",
            key,
            error:
              deleteError instanceof Error
                ? deleteError.message
                : String(deleteError),
          }),
        ),
      ),
    );
  }
  return ok({ count: keys.length });
}

export async function importFromUrl(
  context: DbContext & { executionCtx: ExecutionContext },
  input: { url: string },
) {
  const parsed = parsePublicImageUrl(input.url);
  if (!parsed) {
    return err({ reason: "MEDIA_INVALID_URL" });
  }

  let response: Response;
  try {
    response = await fetch(parsed, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return err({ reason: "MEDIA_IMPORT_FAILED" });
  }

  if (!response.ok) {
    return err({ reason: "MEDIA_IMPORT_FAILED" });
  }

  const mime = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ACCEPTED_IMAGE_TYPES.includes(mime)) {
    return err({ reason: "MEDIA_INVALID" });
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_FILE_SIZE) {
    return err({ reason: "MEDIA_INVALID" });
  }

  const file = new File([buffer], fileNameFromUrl(parsed, mime), {
    type: mime,
  });
  return upload(context, { file });
}

function parsePublicImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return null;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return null;
    }
  }
  return url;
}

function fileNameFromUrl(url: URL, mimeType: string) {
  const last = decodeURIComponent(
    url.pathname.split("/").filter(Boolean).pop() || "",
  );
  if (last && /\.(jpe?g|png|webp|gif)$/i.test(last)) return last;
  const ext =
    mimeType === "image/jpeg" || mimeType === "image/jpg"
      ? "jpg"
      : mimeType.split("/")[1] || "jpg";
  return `image.${ext}`;
}

/** `bytes=start-end` 的单段解析；多段和其它写法一律当成没带。 */
function parseByteRange(header: string | null) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, from, to] = match;
  if (from === "" && to === "") return null;
  return {
    start: from === "" ? null : Number(from),
    end: to === "" ? null : Number(to),
  };
}

export async function handleImageRequest(
  env: Env,
  key: string,
  request: Request,
) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const serveOriginal = async () => {
    // 视频靠 Range 分段加载和拖动进度条，Safari 不给 206 就直接放不出来。
    const requested = parseByteRange(request.headers.get("range"));

    if (requested) {
      const head = await env.R2.head(key);
      if (!head) {
        return new Response("Image not found", { status: 404 });
      }

      const { start, end } = requested;
      const range =
        start === null
          ? { suffix: end ?? 0 }
          : { offset: start, length: (end ?? head.size - 1) - start + 1 };

      const size = head.size;
      const from = start === null ? Math.max(size - (end ?? 0), 0) : start;
      const to = start === null ? size - 1 : Math.min(end ?? size - 1, size - 1);

      if (start !== null && (start >= size || from > to)) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }

      const object = await env.R2.get(key, { range });
      if (!object) {
        return new Response("Image not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set(
        "Content-Type",
        object.httpMetadata?.contentType ||
          getContentTypeFromKey(key) ||
          "application/octet-stream",
      );
      headers.set("ETag", object.httpEtag);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Range", `bytes ${from}-${to}/${size}`);
      headers.set("Content-Length", String(to - from + 1));
      Object.entries(CACHE_CONTROL.public).forEach(([k, v]) => {
        headers.set(k, v);
      });

      return new Response(object.body, { status: 206, headers });
    }

    const object = await env.R2.get(key);
    if (!object) {
      return new Response("Image not found", { status: 404 });
    }

    const contentType =
      object.httpMetadata?.contentType ||
      getContentTypeFromKey(key) ||
      "application/octet-stream";

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", contentType);
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    Object.entries(CACHE_CONTROL.public).forEach(([k, v]) => {
      headers.set(k, v);
    });

    return new Response(object.body, { headers });
  };

  // 1. 防止循环调用 & 显式请求原图
  const viaHeader = request.headers.get("via");
  const isLoop = viaHeader && /image-resizing/.test(viaHeader);
  const wantsOriginal = searchParams.get("original") === "true";

  const isLocalDev =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";

  // Miniflare's local Image Resizing encodes AVIF extremely slowly (~30s for a
  // ~1MB hero image). Serve the R2 original in local dev; production still
  // goes through Cloudflare Image Resizing.
  // 2. 构建 Cloudflare Image Resizing 参数（只接受允许的宽度，其余返回原图）
  const transformOptions = parseImageTransform(
    searchParams,
    request.headers.get("Accept") || "",
  );
  if (
    isLoop ||
    wantsOriginal ||
    isLocalDev ||
    isGifKey(key) ||
    // 视频没有值得变换的东西，交给图片处理只会报错。
    isVideoKey(key) ||
    !transformOptions
  ) {
    return await serveOriginal();
  }

  // 3. 尝试进行图片处理
  try {
    const sourceImageUrl = getTransformSourceUrl(url, key);

    const subRequestHeaders = new Headers();

    const headersToKeep = ["user-agent", "accept"];
    for (const [k, v] of request.headers.entries()) {
      if (headersToKeep.includes(k.toLowerCase())) {
        subRequestHeaders.set(k, v);
      }
    }

    const imageRequest = new Request(sourceImageUrl, {
      headers: subRequestHeaders,
    });

    // 调用 Cloudflare Images 变换
    const response = await fetch(imageRequest, {
      cf: { image: transformOptions },
    });

    // 如果变换失败 (如格式不支持)，降级回原图
    if (!response.ok) {
      console.error(
        JSON.stringify({
          message: "image transform failed",
          key,
          status: response.status,
          statusText: response.statusText,
        }),
      );
      return await serveOriginal();
    }

    // 4. 返回处理后的图片
    // 使用 new Response(response.body, response) 保持状态码和其它优化头信息
    const newResponse = new Response(response.body, response);

    newResponse.headers.set("Vary", "Accept");
    Object.entries(CACHE_CONTROL.immutable).forEach(([k, v]) => {
      newResponse.headers.set(k, v);
    });

    return newResponse;
  } catch (e) {
    console.error(
      JSON.stringify({
        message: "image transform error",
        key,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return await serveOriginal();
  }
}
