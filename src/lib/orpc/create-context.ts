import {
  createRequestCacheHint,
  type RequestCacheHint,
} from "@/features/cache/workers-cache-policy";
import { getAuth } from "@/lib/auth/auth.server";
import { getDb } from "@/lib/db";
import type { ApiContext } from "./context";

export function createApiContext(
  headers: Headers,
  env: Env,
  executionCtx: ExecutionContext<unknown>,
  cacheHint: RequestCacheHint = createRequestCacheHint(),
): ApiContext {
  const db = getDb(env);
  return {
    headers,
    env,
    executionCtx,
    db,
    auth: getAuth({ db, env }),
    cacheHint,
  };
}
