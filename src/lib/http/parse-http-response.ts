/** An HTTP/1.1 response read off a socket. */
export interface RawHttpResponse {
  status: number;
  /** Header names in lower case; a repeated header keeps its last value. */
  headers: Record<string, string>;
  body: string;
}

function concat(chunks: ReadonlyArray<Uint8Array>): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function indexOfCrlf(bytes: Uint8Array, from: number, double = false) {
  for (let i = from; i < bytes.length - (double ? 3 : 1); i++) {
    if (bytes[i] !== 13 || bytes[i + 1] !== 10) continue;
    if (!double || (bytes[i + 2] === 13 && bytes[i + 3] === 10)) return i;
  }
  return -1;
}

/** The body of a `Transfer-Encoding: chunked` message, its chunks joined. */
function dechunk(bytes: Uint8Array): Uint8Array {
  const decoder = new TextDecoder();
  const chunks: Array<Uint8Array> = [];
  let at = 0;
  while (at < bytes.length) {
    const lineEnd = indexOfCrlf(bytes, at);
    if (lineEnd < 0) throw new Error("Truncated chunk size line");
    const size = Number.parseInt(
      decoder.decode(bytes.subarray(at, lineEnd)).split(";")[0].trim(),
      16,
    );
    if (!Number.isFinite(size)) throw new Error("Malformed chunk size");
    if (size === 0) return concat(chunks);
    const start = lineEnd + 2;
    if (start + size > bytes.length) throw new Error("Truncated chunk");
    chunks.push(bytes.subarray(start, start + size));
    at = start + size + 2;
  }
  throw new Error("Chunked body ended without its last chunk");
}

async function decompress(bytes: Uint8Array, encoding: string) {
  const format =
    encoding === "gzip" || encoding === "x-gzip"
      ? "gzip"
      : encoding === "deflate"
        ? "deflate"
        : null;
  if (!format) throw new Error(`Unsupported content encoding: ${encoding}`);
  const stream = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Parses the bytes of an HTTP/1.1 response read until the server closed the
 * connection: the status line, the headers, and the body, undoing chunked
 * transfer encoding and gzip or deflate content encoding.
 */
export async function parseHttpResponse(
  raw: Uint8Array,
): Promise<RawHttpResponse> {
  const headerEnd = indexOfCrlf(raw, 0, true);
  if (headerEnd < 0) throw new Error("Response ended inside its headers");
  const [statusLine, ...headerLines] = new TextDecoder()
    .decode(raw.subarray(0, headerEnd))
    .split("\r\n");
  const status = Number(/^HTTP\/1\.[01] (\d{3})/.exec(statusLine)?.[1]);
  if (!status) throw new Error(`Malformed status line: ${statusLine}`);

  const headers: Record<string, string> = {};
  for (const line of headerLines) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      headers[line.slice(0, colon).trim().toLowerCase()] = line
        .slice(colon + 1)
        .trim();
    }
  }

  let body = raw.subarray(headerEnd + 4);
  if (/\bchunked\b/i.test(headers["transfer-encoding"] ?? "")) {
    body = dechunk(body);
  } else if (headers["content-length"]) {
    body = body.subarray(0, Number(headers["content-length"]));
  }
  const encoding = headers["content-encoding"]?.toLowerCase();
  if (encoding && encoding !== "identity") {
    body = await decompress(body, encoding);
  }
  return { status, headers, body: new TextDecoder().decode(body) };
}
