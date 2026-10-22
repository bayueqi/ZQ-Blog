import { z } from "zod";
import {
  CONFIG_ERRORS,
  SavedSecretInputSchema,
} from "@/features/config/config.admin.schema";
import { resolveTestSecret } from "@/features/config/service/config.service";
import { sendWebhookRequest } from "@/features/webhook/api/webhook.consumer";
import { listTelegramChats } from "@/features/webhook/api/telegram";
import { createAdminRootExampleEvent } from "@/features/webhook/webhook.helpers";
import { missingWebhookField } from "@/features/webhook/webhook.providers";
import {
  WEBHOOK_TEMPLATE_MAX_LENGTH,
  webhookProviderSchema,
} from "@/features/webhook/webhook.schema";
import { serverEnv } from "@/lib/env/server.env";
import { adminProcedure } from "@/lib/orpc/procedure";

const webhookErrors = {
  ...CONFIG_ERRORS,
  DELIVERY_FAILED: { status: 400, message: "The webhook was not delivered." },
} as const;

/** The receiving service's own error tells the Admin what to fix. */
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const test = adminProcedure
  .errors(webhookErrors)
  .route({
    method: "POST",
    path: "/admin/webhooks/test",
    summary: "Send a test webhook",
    description:
      "Tests the supplied connection without saving settings. The secret (the generic or custom signing key, or the Telegram bot token) accepts replace with a new value or keep with the notification section expectedRevision; keep resolves the saved secret server-side, rejects stale revisions with CONFIG_CONFLICT, and rejects a channel other than the saved one with CONFIG_INVALID. Saved secrets are never returned. DELIVERY_FAILED carries the receiving service's error.",
    tags: ["Admin Webhooks"],
  })
  .input(
    z
      .object({
        provider: webhookProviderSchema.default("generic"),
        url: z.union([z.url(), z.literal("")]).default(""),
        chatId: z.string().trim().max(100).optional(),
        template: z.string().max(WEBHOOK_TEMPLATE_MAX_LENGTH).optional(),
        secret: SavedSecretInputSchema.optional(),
      })
      .strict(),
  )
  .handler(async ({ context, input, errors }) => {
    const locale = serverEnv(context.env).LOCALE;
    const endpoint = {
      provider: input.provider,
      url: input.url,
      chatId: input.chatId,
      template: input.template,
      secret: input.secret
        ? await resolveTestSecret(
            context,
            "webhookSecret",
            input.secret,
            input.provider,
          )
        : "",
    };
    const missing = missingWebhookField(endpoint);
    if (missing)
      throw errors.CONFIG_INVALID({
        data: { field: `notification.webhook.${missing}` },
      });

    try {
      await sendWebhookRequest(
        { env: context.env },
        { ...endpoint, event: createAdminRootExampleEvent(locale) },
        crypto.randomUUID(),
        { isTest: true },
      );
    } catch (error) {
      throw errors.DELIVERY_FAILED({ message: messageOf(error) });
    }

    return { success: true };
  });

const telegramChats = adminProcedure
  .errors(webhookErrors)
  .route({
    method: "POST",
    path: "/admin/webhooks/telegram/chats",
    summary: "List the chats a Telegram bot was messaged from",
    description:
      "Reads the bot's pending updates (getUpdates) and returns each chat once, so the Admin can pick a Chat ID. A chat appears after someone messages the bot there or adds it to a group, and updates expire after 24 hours. The token accepts replace or keep, as for the test.",
    tags: ["Admin Webhooks"],
  })
  .input(z.object({ token: SavedSecretInputSchema }).strict())
  .handler(async ({ context, input, errors }) => {
    const token = await resolveTestSecret(
      context,
      "webhookSecret",
      input.token,
      "telegram",
    );
    try {
      return { chats: await listTelegramChats(token) };
    } catch (error) {
      throw errors.DELIVERY_FAILED({ message: messageOf(error) });
    }
  });

export default {
  test,
  telegramChats,
};
