import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import * as MomentsRepo from "@/features/moments/data/moments.data";
import {
  momentAccessCookieName,
  signMomentAccess,
  verifyMomentPassword,
} from "@/features/moments/moments-access";
import { getDb } from "@/lib/db";
import { serverEnv } from "@/lib/env/server.env";

const UnlockInputSchema = z.object({
  id: z.number().int().positive(),
  password: z.string().min(1).max(100),
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

export const Route = createFileRoute("/api/moments-unlock")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const parsed = UnlockInputSchema.safeParse(await request.json());
        if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);

        const moment = await MomentsRepo.findById(
          getDb(context.env),
          parsed.data.id,
        );
        if (!moment) return json({ error: "MOMENT_NOT_FOUND" }, 404);
        if (!moment.accessPasswordHash) {
          return json({
            ok: true,
            body: moment.body,
            images: moment.images ?? [],
          });
        }

        const valid = await verifyMomentPassword(
          parsed.data.password,
          moment.accessPasswordHash,
        );
        if (!valid) return json({ error: "WRONG_PASSWORD" }, 401);

        const token = await signMomentAccess(
          serverEnv(context.env).BETTER_AUTH_SECRET,
          moment.id,
          moment.accessPasswordHash,
        );
        return json(
          { ok: true, body: moment.body, images: moment.images ?? [] },
          200,
          {
            "set-cookie": `${momentAccessCookieName(moment.id)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
          },
        );
      },
    },
  },
});
