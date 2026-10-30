import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import * as GalleryRepo from "@/features/gallery/data/gallery.data";
import {
  galleryAccessCookieName,
  signGalleryAccess,
  verifyGalleryPassword,
} from "@/features/gallery/gallery-access";
import { getDb } from "@/lib/db";
import { serverEnv } from "@/lib/env/server.env";

const UnlockInputSchema = z.object({
  categoryId: z.number().int().positive(),
  password: z.string().min(1).max(200),
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

export const Route = createFileRoute("/api/gallery-unlock")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const parsed = UnlockInputSchema.safeParse(await request.json());
        if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);

        const category = await GalleryRepo.findCategoryById(
          getDb(context.env),
          parsed.data.categoryId,
        );
        if (!category) return json({ error: "CATEGORY_NOT_FOUND" }, 404);
        if (!category.accessPasswordHash) return json({ ok: true });

        const valid = await verifyGalleryPassword(
          parsed.data.password,
          category.accessPasswordHash,
        );
        if (!valid) return json({ error: "WRONG_PASSWORD" }, 401);

        const token = await signGalleryAccess(
          serverEnv(context.env).BETTER_AUTH_SECRET,
          category.id,
          category.accessPasswordHash,
        );
        return json({ ok: true }, 200, {
          "set-cookie": `${galleryAccessCookieName(category.id)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
        });
      },
    },
  },
});
