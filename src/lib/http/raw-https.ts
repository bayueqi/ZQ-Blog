import type { RawHttpResponse } from "./parse-http-response";
import { parseHttpResponse } from "./parse-http-response";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * A GET over a plain TLS socket instead of `fetch()`.
 *
 * Workers' `fetch()` adds `cf-connecting-ip`, `cf-ipcountry` and `cf-worker`
 * headers to every outbound request, and some sites refuse anything carrying
 * them: Bilibili answers 412 "request was banned". A socket sends only the
 * headers written here. Credit for the approach:
 * https://blog.nichijou.moe/posts/bili-video/
 *
 * HTTP/1.1 with `Connection: close`: no redirects, no keep-alive, at most
 * 2 MiB read. Throws when the connection fails, times out or the response
 * cannot be parsed.
 */
export async function rawHttpsGet(
  url: URL,
  headers: Record<string, string> = {},
  timeoutMs = 8_000,
): Promise<RawHttpResponse> {
  if (url.protocol !== "https:") throw new Error("rawHttpsGet needs https");
  // Loaded on use: only workerd has the module, and the router is also
  // imported outside it to generate the oRPC contract.
  const { connect } = await import("cloudflare:sockets");
  const socket = connect(
    { hostname: url.hostname, port: Number(url.port) || 443 },
    { secureTransport: "on", allowHalfOpen: false },
  );
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void socket.close().catch(() => {});
  }, timeoutMs);

  try {
    const request = [
      `GET ${url.pathname}${url.search} HTTP/1.1`,
      `Host: ${url.host}`,
      "Accept-Encoding: identity",
      "Connection: close",
      ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    ].join("\r\n");
    const writer = socket.writable.getWriter();
    await writer.write(new TextEncoder().encode(`${request}\r\n\r\n`));
    writer.releaseLock();

    const chunks: Array<Uint8Array> = [];
    let size = 0;
    const reader = socket.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_RESPONSE_BYTES) throw new Error("Response too large");
      chunks.push(value);
    }
    if (timedOut) throw new Error(`Timed out after ${timeoutMs} ms`);

    const raw = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      raw.set(chunk, offset);
      offset += chunk.length;
    }
    return await parseHttpResponse(raw);
  } catch (error) {
    if (timedOut) throw new Error(`Timed out after ${timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
    void socket.close().catch(() => {});
  }
}
