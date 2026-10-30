import { createFileRoute } from "@tanstack/react-router";
import { isVisitor, parseUserAgent } from "@/features/visits/visit-agent";
import { utcDay } from "@/features/visits/visits";
import { recordVisit } from "@/features/visits/data/visits.data";
import { getDb } from "@/lib/db";

// 埋点接口：POST 不经过边缘缓存，所以每次页面浏览都会到 Worker。
export const Route = createFileRoute("/api/visit")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const userAgent = request.headers.get("user-agent");
        if (!isVisitor(userAgent)) return new Response(null, { status: 204 });

        // CF-IPCountry 由边缘注入，请求被中间件重建也不会丢。
        const country =
          request.headers.get("cf-ipcountry")?.trim() ||
          (request as Request & { cf?: { country?: string } }).cf?.country ||
          "ZZ";

        try {
          await recordVisit(getDb(context.env), {
            day: utcDay(new Date()),
            country: country.slice(0, 8),
            ...parseUserAgent(userAgent ?? ""),
          });
        } catch {
          // 没建表或写失败时静默丢弃这一次。
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
