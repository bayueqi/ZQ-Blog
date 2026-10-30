import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import * as PostRepo from "@/features/posts/data/posts.data";
import {
  postAccessCookieName,
  signPostAccess,
  verifyPostPassword,
} from "@/features/posts/utils/post-access";
import { getDb } from "@/lib/db";
import { serverEnv } from "@/lib/env/server.env";

const UnlockInputSchema = z.object({
  slug: z.string().min(1),
  password: z.string().min(1).max(200),
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

export const Route = createFileRoute("/api/post-unlock")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const parsed = UnlockInputSchema.safeParse(await request.json());
        if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);

        const post = await PostRepo.findPublishedPostAccessBySlug(
          getDb(context.env),
          parsed.data.slug,
        );
        if (!post) return json({ error: "POST_NOT_FOUND" }, 404);
        if (post.visibility !== "password" || !post.accessPasswordHash) {
          return json({ ok: true });
        }

        const valid = await verifyPostPassword(
          parsed.data.password,
          post.accessPasswordHash,
        );
        if (!valid) return json({ error: "WRONG_PASSWORD" }, 401);

        const token = await signPostAccess(
          serverEnv(context.env).BETTER_AUTH_SECRET,
          post.id,
          post.accessPasswordHash,
        );
        return json({ ok: true }, 200, {
          "set-cookie": `${postAccessCookieName(post.id)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
        });
      },
    },
  },
});
