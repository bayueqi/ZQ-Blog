import { app } from "@/lib/hono/routes";
import { paraglideMiddleware } from "@/paraglide/server";

/**
 * 从 Cloudflare request.cf 对象提取省市地理信息,注入到自定义请求头,
 * 供下游 server function / Hono 路由读取。
 *
 * 背景:Cloudflare 默认只注入 CF-IPCountry 头(国家代码),
 * CF-IPRegion / CF-IPCity 等更细粒度的头默认不带;
 * 而 request.cf 对象(含 region/city)只在 Worker 最外层可访问,
 * TanStack Start server function 经抽象后读不到。
 * 因此在这里把 cf 信息序列化成自定义头传下去。
 */
function withCfGeoHeaders(request: Request): Request {
  // 本地开发 / 非 Cloudflare 环境没有 cf 对象,直接返回原请求
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf;
  if (!cf) return request;

  const region =
    typeof cf.region === "string"
      ? cf.region
      : typeof cf.regionName === "string"
        ? cf.regionName
        : "";
  const city = typeof cf.city === "string" ? cf.city : "";

  // 没有任何地理信息就不构造新请求,避免无谓克隆
  if (!region && !city) return request;

  const headers = new Headers(request.headers);
  if (region) headers.set("x-visitor-region", region);
  if (city) headers.set("x-visitor-city", city);

  return new Request(request, { headers });
}

export const appWorkerHandler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const enrichedRequest = withCfGeoHeaders(request);
    return paraglideMiddleware(enrichedRequest, () =>
      app.fetch(enrichedRequest, env, ctx),
    );
  },
};
