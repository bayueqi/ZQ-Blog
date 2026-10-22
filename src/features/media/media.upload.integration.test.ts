import { env } from "cloudflare:workers";
import { createMockExecutionCtx, seedAdminApiKey } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";

/**
 * Uploads every accepted format through the real POST /api/admin/media route,
 * so the mime allow-list on the procedure and the header parsing in
 * getImageDimensions are both exercised the way a client reaches them.
 *
 * The raster fixtures are real encoder output, not hand-written headers, and
 * every format carries a different odd size so a mixed-up parse is obvious.
 */
const FIXTURES = {
  png: {
    mime: "image/png",
    width: 23,
    height: 17,
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAABcAAAARCAIAAAC5EaDqAAAAHUlEQVR4nGOsCDjBQDFgotyIUVNGTRk1ZdQUrAAAlAUBsqIel+IAAAAASUVORK5CYII=",
  },
  jpeg: {
    mime: "image/jpeg",
    width: 41,
    height: 29,
    base64:
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAdACkDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDJooor686QooooAKKKKACiiigAooooAKKKKAP/2Q==",
  },
  gif: {
    mime: "image/gif",
    width: 13,
    height: 7,
    base64:
      "R0lGODdhDQAHAIEAAHhQyAAAAAAAAAAAACwAAAAADQAHAAAIEQABCBxIsKDBgwgTKlzIsGFAADs=",
  },
  webp: {
    mime: "image/webp",
    width: 37,
    height: 19,
    base64:
      "UklGRkYAAABXRUJQVlA4IDoAAAAQAwCdASolABMAPm02l0ikIqIhJWgAgA2JZwAAKUPS+AAA/ulpH//zNH/pN/2G9eH6tJpE2+ULAAAA",
  },
} as const;

function bytes(base64: string) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function upload(apiKey: string, file: File) {
  const form = new FormData();
  form.set("image", file);
  const request = new Request("http://localhost:3000/api/admin/media", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  const { response } = await openAPIHandler.handle(request, {
    prefix: "/api",
    context: createApiContext(request.headers, env, createMockExecutionCtx()),
  });
  if (!response) throw new Error("No route matched POST /admin/media");
  const raw = await response.text();
  return {
    status: response.status,
    body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
  };
}

describe("POST /api/admin/media", () => {
  it.each(Object.entries(FIXTURES))(
    "stores a %s upload with the size the encoder wrote",
    async (name, fixture) => {
      const apiKey = await seedAdminApiKey();
      const file = new File([bytes(fixture.base64)], `fixture.${name}`, {
        type: fixture.mime,
      });

      const { status, body } = await upload(apiKey, file);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        mimeType: fixture.mime,
        width: fixture.width,
        height: fixture.height,
      });
    },
  );

  it("stores an SVG with the size drawn on its root element", async () => {
    const apiKey = await seedAdminApiKey();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120"/></svg>';
    const file = new File([svg], "diagram.svg", { type: "image/svg+xml" });

    const { status, body } = await upload(apiKey, file);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      mimeType: "image/svg+xml",
      width: 240,
      height: 120,
    });
  });

  it("falls back to the viewBox for an SVG sized in percentages", async () => {
    const apiKey = await seedAdminApiKey();
    const svg =
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 640 480"></svg>';
    const file = new File([svg], "responsive.svg", { type: "image/svg+xml" });

    const { status, body } = await upload(apiKey, file);

    expect(status).toBe(200);
    expect(body).toMatchObject({ width: 640, height: 480 });
  });

  it("refuses a format that is not on the allow-list", async () => {
    const apiKey = await seedAdminApiKey();
    // AVIF is deliberately excluded: Cloudflare only accepts it as a
    // transformation input on an Enterprise plan, so it could never be resized.
    const file = new File([bytes(FIXTURES.png.base64)], "photo.avif", {
      type: "image/avif",
    });

    const { status } = await upload(apiKey, file);

    expect(status).toBe(400);
  });
});
