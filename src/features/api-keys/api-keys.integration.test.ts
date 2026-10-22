import { env } from "cloudflare:workers";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { eq } from "drizzle-orm";
import {
  createMockAdminSession,
  createTestContext,
  seedUser,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import { getAuth } from "@/lib/auth/auth.server";
import { apikey } from "@/lib/db/schema/auth.table";
import { adminProcedure } from "@/lib/orpc/procedure";

describe("Admin API Keys", () => {
  it("returns authentication errors instead of 500 for revoked and malformed keys", async () => {
    const context = createTestContext();
    const admin = createMockAdminSession().user;
    await seedUser(context.db, admin);
    const auth = getAuth({ db: context.db, env });
    const created = await auth.api.createApiKey({
      body: { name: "revocation-test", userId: admin.id },
    });
    const handler = new OpenAPIHandler({
      protected: adminProcedure
        .route({ method: "GET", path: "/protected" })
        .handler(() => ({ success: true })),
    });
    const request = async (key: string) => {
      const headers = new Headers({ "x-api-key": key });
      const result = await handler.handle(
        new Request("http://localhost:3000/protected", { headers }),
        { context: { ...context, auth, headers } },
      );
      if (!result.response) throw new Error("Protected route was not matched");
      return result.response;
    };

    expect((await request(created.key)).status).toBe(200);
    await context.db.delete(apikey).where(eq(apikey.id, created.id));
    const revoked = await request(created.key);
    expect(revoked.status).toBe(401);
    expect(await revoked.json()).toMatchObject({ code: "UNAUTHORIZED" });
    expect((await request("invalid")).status).toBe(403);
  });

  it("lets an Admin key impersonate the Admin session and blocks key management", async () => {
    const context = createTestContext();
    const admin = createMockAdminSession().user;
    await seedUser(context.db, admin);
    const auth = getAuth({ db: context.db, env });

    const created = await auth.api.createApiKey({
      body: { name: "grok", userId: admin.id },
    });

    expect(created.key).toMatch(/^fsb_/);
    expect(created.name).toBe("grok");
    expect(created.rateLimitEnabled).toBe(false);

    const session = await auth.api.getSession({
      headers: new Headers({ "x-api-key": created.key }),
    });
    expect(session?.user.id).toBe(admin.id);
    expect(session?.user.role).toBe("admin");

    await expect(
      auth.api.createApiKey({
        body: { name: "spawned" },
        headers: new Headers({ "x-api-key": created.key }),
      }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });

    await expect(
      auth.api.listApiKeys({
        headers: new Headers({ "x-api-key": created.key }),
      }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });

    await expect(
      auth.api.deleteApiKey({
        body: { keyId: created.id },
        headers: new Headers({ "x-api-key": created.key }),
      }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("rejects HTTP API Key management without an Admin browser session", async () => {
    const context = createTestContext();
    const auth = getAuth({ db: context.db, env });

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/api-key/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "nope" }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
