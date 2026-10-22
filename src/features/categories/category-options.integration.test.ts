import { env } from "cloudflare:workers";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { drizzle } from "drizzle-orm/d1";
import { expect, it, vi } from "vitest";
import { createAdminTestContext, createMockSession } from "tests/test-utils";
import * as schema from "@/lib/db/schema";
import { getCategoryOptions } from "./data/category-options.data";
import categoryRouter from "./server/router";

it("lists every Category's ID and name in name order without querying Post counts", async () => {
  const db = drizzle(env.DB, { schema });
  await db.insert(schema.CategoriesTable).values([
    { id: 1, name: "Zeta unused" },
    { id: 2, name: "Alpha unused" },
  ]);
  const statements: string[] = [];
  const observedDb = drizzle(env.DB, {
    schema,
    logger: { logQuery: (query) => statements.push(query) },
  });

  expect(await getCategoryOptions(observedDb)).toEqual([
    { id: 2, name: "Alpha unused" },
    { id: 1, name: "Zeta unused" },
  ]);
  expect(statements).toHaveLength(1);
  expect(statements[0].match(/\bselect\b/gi)).toHaveLength(1);
  expect(statements[0]).not.toMatch(/\b(join|count|sum|group by)\b/i);
});

it("requires an Admin session and exposes only Category option fields on the HTTP endpoint", async () => {
  const context = createAdminTestContext();
  await context.db
    .insert(schema.CategoriesTable)
    .values({ id: 1, name: "Not published yet" });
  const getSession = vi.spyOn(context.auth.api, "getSession");
  const handler = new OpenAPIHandler({ categories: categoryRouter });
  const request = async () => {
    const result = await handler.handle(
      new Request("http://example.test/admin/categories/options"),
      {
        context: { ...context, headers: new Headers() },
      },
    );
    if (!result.response)
      throw new Error("Category options route was not matched");
    return result.response;
  };

  getSession.mockResolvedValue(null);
  expect((await request()).status).toBe(401);
  getSession.mockResolvedValue(createMockSession());
  expect((await request()).status).toBe(403);
  getSession.mockResolvedValue(context.session);
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([{ id: 1, name: "Not published yet" }]);
});
