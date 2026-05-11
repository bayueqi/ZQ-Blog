import type { Context } from "hono";
import { CACHE_CONTROL } from "@/lib/constants";

export function createRateLimiterIdentifier(
  c: Context,
  options: { includeQuery?: boolean } = {},
) {
  const identifier = c.req.header("cf-connecting-ip") ?? "unknown";
  const { pathname, search } = new URL(c.req.url);
  return `${identifier}:${c.req.method}:${pathname}${options.includeQuery ? search : ""}`;
}

export const setCacheHeaders = (
  headers: Headers,
  strategy: keyof typeof CACHE_CONTROL,
) => {
  Object.entries(CACHE_CONTROL[strategy]).forEach(([k, v]) => {
    headers.set(k, v);
  });
};

export function getExecutionContext(c: Context) {
  return c.executionCtx as ExecutionContext<unknown>;
}

export function getServiceContext(c: Context<{ Bindings: Env }>) {
  return {
    db: c.get("db"),
    env: c.env,
    executionCtx: getExecutionContext(c),
  };
}
