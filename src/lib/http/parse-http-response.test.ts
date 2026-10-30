import { gzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { parseHttpResponse } from "./parse-http-response";

function bytes(...parts: Array<string | Uint8Array>) {
  const encoded = parts.map((part) =>
    typeof part === "string" ? new TextEncoder().encode(part) : part,
  );
  const out = new Uint8Array(encoded.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of encoded) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

it("reads the status, lower-cased headers and a Content-Length body", async () => {
  const response = await parseHttpResponse(
    bytes(
      "HTTP/1.1 412 Precondition Failed\r\nContent-Type: application/json\r\nContent-Length: 13\r\n\r\n",
      '{"code":-412}trailing',
    ),
  );
  expect(response).toEqual({
    status: 412,
    headers: {
      "content-type": "application/json",
      "content-length": "13",
    },
    body: '{"code":-412}',
  });
});

it("joins a chunked body, multi-byte characters split across chunks included", async () => {
  const title = new TextEncoder().encode("不买服务器");
  const response = await parseHttpResponse(
    bytes(
      "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n",
      "4\r\n",
      title.subarray(0, 4),
      "\r\n",
      `${(title.length - 4).toString(16)};ext=1\r\n`,
      title.subarray(4),
      "\r\n0\r\n\r\n",
    ),
  );
  expect(response.body).toBe("不买服务器");
});

it("inflates a gzip body", async () => {
  const response = await parseHttpResponse(
    bytes(
      "HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n",
      new Uint8Array(gzipSync('{"code":0}')),
    ),
  );
  expect(response.body).toBe('{"code":0}');
});

it("rejects a response cut off in its headers or chunks", async () => {
  await expect(
    parseHttpResponse(bytes("HTTP/1.1 200 OK\r\nContent-")),
  ).rejects.toThrow("inside its headers");
  await expect(
    parseHttpResponse(
      bytes(
        "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n",
        "a\r\nabc",
      ),
    ),
  ).rejects.toThrow("Truncated chunk");
  await expect(parseHttpResponse(bytes("garbage\r\n\r\n"))).rejects.toThrow(
    "Malformed status line",
  );
});
