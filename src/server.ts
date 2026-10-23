import { WorkerEntrypoint } from "cloudflare:workers";
import handler from "@tanstack/react-start/server-entry";
import { applyWorkersCachePurge } from "@/features/cache/workers-cache";
import {
  applyWorkersCachePolicy,
  createRequestCacheHint,
  workersCacheKey,
  type RequestCacheHint,
  type WorkersCachePurgeTarget,
} from "@/features/cache/workers-cache-policy";
import { handleQueueBatch } from "@/lib/queue/queue.handler";
import { extractLocaleFromRequest } from "@/paraglide/runtime";
import { paraglideMiddleware } from "@/paraglide/server";

export { PostPublisher } from "@/lib/do/post-publisher";
export { RateLimiter } from "@/lib/do/rate-limiter";

declare module "@tanstack/react-start" {
  interface Register {
    server: {
      requestContext: {
        env: Env;
        executionCtx: ExecutionContext<unknown>;
        cacheHint: RequestCacheHint;
      };
    };
  }
}

type AppProps = {
  locale: string;
};

export class App extends WorkerEntrypoint<Env, AppProps> {
  async fetch(request: Request) {
    const cacheHint = createRequestCacheHint();
    const response = await paraglideMiddleware(request, () =>
      handler.fetch(request, {
        context: {
          env: this.env,
          executionCtx: this.ctx,
          cacheHint,
        },
      }),
    );
    return applyWorkersCachePolicy(request, response, cacheHint);
  }

  async purgeCache(target: WorkersCachePurgeTarget) {
    const { cache } = await import("cloudflare:workers");
    await applyWorkersCachePurge(this.ctx.cache ?? cache, target);
  }
}

export default {
  async fetch(request, _env, ctx) {
    const locale = extractLocaleFromRequest(request);
    return ctx.exports.App({ props: { locale } }).fetch(request, {
      // Cached pages name the hashed assets of the build that rendered them,
      // and a deploy removes those assets, so each build gets its own keys.
      cf: {
        cacheKey: `/_build/${__BUILD_ID__}${workersCacheKey(request.url)}`,
      },
    });
  },
  async queue(batch, env, ctx) {
    await handleQueueBatch(batch, env, ctx);
  },
} satisfies ExportedHandler<Env>;
