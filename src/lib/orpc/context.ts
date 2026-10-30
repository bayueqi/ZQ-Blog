import type { RequestCacheHint } from "@/features/cache/workers-cache-policy";

export type ApiContext = {
  headers: Headers;
  env: Env;
  executionCtx: ExecutionContext<unknown>;
  db: DB;
  auth: Auth;
  /** 本次请求的响应能不能公开缓存，由渲染过程决定。 */
  cacheHint: RequestCacheHint;
};

export type AuthedApiContext = ApiContext & {
  session: Session;
};
