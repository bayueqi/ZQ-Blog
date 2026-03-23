import { describe, expect, it } from "vitest";
import { applyMcpOriginPolicy, isAllowedMcpOrigin } from "./mcp-origin";

describe("mcp origin policy", () => {
  it("allows requests without an Origin header", () => {
    const request = new Request("https://blog.example.com/mcp");

    expect(isAllowedMcpOrigin(request)).toBe(true);
  });

  it("allows same-origin requests", () => {
    const request = new Request("https://blog.example.com/mcp", {
      headers: {
        Origin: "https://blog.example.com",
      },
    });

    expect(isAllowedMcpOrigin(request)).toBe(true);
  });

  it("rejects cross-origin requests", () => {
    const request = new Request("https://blog.example.com/mcp", {
      headers: {
        Origin: "https://evil.example.com",
      },
    });

    expect(isAllowedMcpOrigin(request)).toBe(false);
  });

  it("rewrites wildcard CORS headers to the request origin", () => {
    const request = new Request("https://blog.example.com/mcp", {
      headers: {
        Origin: "https://blog.example.com",
      },
    });
    const response = new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });

    const normalizedResponse = applyMcpOriginPolicy(request, response);

    expect(normalizedResponse.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://blog.example.com",
    );
    expect(normalizedResponse.headers.get("Vary")).toContain("Origin");
  });

  it("removes wildcard CORS when there is no Origin header", () => {
    const request = new Request("https://blog.example.com/mcp");
    const response = new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });

    const normalizedResponse = applyMcpOriginPolicy(request, response);

    expect(normalizedResponse.headers.has("Access-Control-Allow-Origin")).toBe(
      false,
    );
  });
});
