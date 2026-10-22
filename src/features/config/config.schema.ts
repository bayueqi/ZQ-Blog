import { z } from "zod";
import { blogConfig } from "@/blog.config";
import {
  type SiteConfigInput,
  SiteConfigInputSchema,
} from "@/features/config/site-config.schema";
import {
  legacyWebhookEndpointSchema,
  webhookEndpointSchema,
} from "@/features/webhook/webhook.schema";

export const SystemConfigSchema = z.object({
  email: z
    .object({
      apiKey: z.string().optional(),
      host: z.string().optional(),
      port: z.number().int().positive().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      senderName: z.string().optional(),
      senderAddress: z.union([z.email(), z.literal("")]).optional(),
    })
    .optional(),
  notification: z
    .object({
      admin: z
        .object({
          channels: z
            .object({
              email: z.boolean().optional(),
              webhook: z.boolean().optional(),
            })
            .optional(),
        })
        .optional(),
      user: z
        .object({
          emailEnabled: z.boolean().optional(),
        })
        .optional(),
      webhook: webhookEndpointSchema.optional(),
      webhooks: z.array(legacyWebhookEndpointSchema).optional(),
    })
    .optional(),
  site: SiteConfigInputSchema.optional(),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type { SiteConfig } from "@/features/config/site-config.schema";

export const DEFAULT_CONFIG: SystemConfig = {
  email: {
    host: "",
    port: 465,
    username: "",
    password: "",
    senderName: "",
    senderAddress: "",
  },
  notification: {
    admin: {
      channels: {
        email: true,
      },
    },
    user: {
      emailEnabled: true,
    },
    webhook: {
      url: "",
      secret: "",
    },
  },
  site: blogConfig satisfies SiteConfigInput,
};
