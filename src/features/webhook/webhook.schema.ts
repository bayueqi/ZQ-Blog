import { z } from "zod";

/**
 * Where admin notifications are pushed. `generic` posts the signed Flare JSON
 * body for a receiver the admin runs; the others speak a chat or push
 * service's own format, and `custom` fills a body template.
 */
export const WEBHOOK_PROVIDERS = [
  "generic",
  "telegram",
  "discord",
  "feishu",
  "dingtalk",
  "wecom",
  "bark",
  "ntfy",
  "custom",
] as const;

export const webhookProviderSchema = z.enum(WEBHOOK_PROVIDERS);
export type WebhookProvider = z.infer<typeof webhookProviderSchema>;

/**
 * `secret` holds the generic and custom signing key, or Telegram's bot
 * token. A missing provider is `generic`, the only kind before providers.
 */
export const webhookEndpointSchema = z.object({
  provider: webhookProviderSchema.optional(),
  url: z.string(),
  secret: z.string(),
  chatId: z.string().optional(),
  template: z.string().optional(),
});

export const WEBHOOK_TEMPLATE_MAX_LENGTH = 4000;

export const legacyWebhookEndpointSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  enabled: z.boolean().optional(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
});

export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>;
