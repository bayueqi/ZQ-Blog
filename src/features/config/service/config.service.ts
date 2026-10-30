import { ORPCError } from "@orpc/server";
import {
  UpdateConfigSectionSchema,
  type UpdateConfigSection,
  type AdminConfigSnapshot,
  type SecretChange,
  type SavedSecretInput,
} from "../config.admin.schema";
import { invalidate } from "@/features/cache/public-cache";
import { systemConfig } from "@/features/config/config.cache";
import {
  resolveSiteConfig,
  resolveSystemConfig,
} from "@/features/config/config.resolve";
import type { SiteConfig } from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import * as Storage from "@/features/media/data/media.storage";
import {
  isWebhookEmpty,
  missingWebhookField,
  webhookSecretUse,
} from "@/features/webhook/webhook.providers";
import type {
  WebhookEndpoint,
  WebhookProvider,
} from "@/features/webhook/webhook.schema";

type UpdateNotifications = Extract<
  UpdateConfigSection,
  { section: "notifications" }
>;

export async function getSystemConfig(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  return systemConfig.get(context, {});
}

export async function getSiteConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<SiteConfig> {
  const config = await getSystemConfig(context);
  return resolveSiteConfig(config);
}

export async function getAdminConfig(
  context: DbContext,
): Promise<AdminConfigSnapshot> {
  const snapshot = await ConfigRepo.getConfigSnapshot(context.db);
  return redactSnapshot(snapshot);
}
function redactSnapshot(
  snapshot: Awaited<ReturnType<typeof ConfigRepo.getConfigSnapshot>>,
): AdminConfigSnapshot {
  const config = snapshot.config;
  return {
    config: {
      ...config,
      email: {
        host: config.email?.host,
        port: config.email?.port,
        username: config.email?.username,
        senderName: config.email?.senderName,
        senderAddress: config.email?.senderAddress,
        password: "",
      },
      notification: {
        ...config.notification,
        webhook: {
          ...config.notification?.webhook,
          url: config.notification?.webhook?.url ?? "",
          secret: "",
        },
      },
    },
    revisions: {
      site: snapshot.siteRevision,
      notifications: snapshot.notificationRevision,
    },
    secrets: {
      emailPasswordConfigured: !!config.email?.password,
      webhookSecretConfigured: !!config.notification?.webhook?.secret,
    },
    schemaVersion: 1,
  };
}
function changeSecret(current: string | undefined, change: SecretChange) {
  return change.action === "keep"
    ? (current ?? "")
    : change.action === "clear"
      ? ""
      : change.value;
}
/**
 * The saved endpoint after an edit. The secret means something different per
 * channel (a signing key, a bot token), so a kept secret does not follow the
 * admin to another channel, and channels without one drop it.
 */
function nextWebhook(
  current: WebhookEndpoint | undefined,
  input: UpdateNotifications["notification"]["webhook"],
  secretChange: SecretChange,
): WebhookEndpoint {
  const currentProvider = current?.provider ?? "generic";
  const provider = input.provider ?? currentProvider;
  const secret =
    webhookSecretUse(provider) === "none" ||
    (secretChange.action === "keep" && provider !== currentProvider)
      ? ""
      : changeSecret(current?.secret, secretChange);
  const chatId = input.chatId ?? current?.chatId;
  const template = input.template ?? current?.template;
  return {
    ...(provider !== "generic" && { provider }),
    url: provider === "telegram" ? "" : input.url,
    secret,
    ...(chatId && { chatId }),
    ...(template && { template }),
  };
}
export async function updateSystemConfig(
  context: DbContext & { executionCtx: ExecutionContext },
  input: UpdateConfigSection,
) {
  const data = UpdateConfigSectionSchema.parse(input);
  // Retry only unrelated-section races, always rebuilding from the latest row.
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await ConfigRepo.getConfigSnapshot(context.db);
    const revision =
      data.section === "site"
        ? current.siteRevision
        : current.notificationRevision;
    if (revision !== data.expectedRevision)
      throw new ORPCError("CONFIG_CONFLICT", { status: 409 });
    const nextConfig =
      data.section === "site"
        ? resolveSystemConfig({ ...current.config, site: data.site })
        : resolveSystemConfig({
            ...current.config,
            email: {
              ...data.email,
              password: changeSecret(
                current.config.email?.password,
                data.secrets.emailPassword,
              ),
            },
            notification: {
              ...data.notification,
              webhook: nextWebhook(
                current.config.notification?.webhook,
                data.notification.webhook,
                data.secrets.webhookSecret,
              ),
            },
          });
    if (data.section === "notifications") {
      const email = nextConfig.email!;
      const endpoint = nextConfig.notification!.webhook!;
      // A cleared/unconfigured password is allowed; a usable credential requires a complete account.
      if (
        email.password &&
        !(email.host && email.username && email.senderAddress)
      )
        throw new ORPCError("CONFIG_INVALID", {
          status: 400,
          data: { field: "email" },
        });
      // Empty turns notifications off; anything entered must be complete.
      const missing = isWebhookEmpty(endpoint)
        ? null
        : missingWebhookField(endpoint);
      if (missing)
        throw new ORPCError("CONFIG_INVALID", {
          status: 400,
          data: { field: `notification.webhook.${missing}` },
        });
    }
    if (
      !(await ConfigRepo.compareAndSetConfig(
        context.db,
        current,
        nextConfig,
        data.section,
      ))
    )
      continue;
    await invalidate.siteConfigChanged(context);
    return redactSnapshot({
      config: nextConfig,
      siteRevision: current.siteRevision + (data.section === "site" ? 1 : 0),
      notificationRevision:
        current.notificationRevision +
        (data.section === "notifications" ? 1 : 0),
    });
  }
  throw new ORPCError("CONFIG_CONFLICT", { status: 409 });
}
export async function resolveTestSecret(
  context: DbContext,
  kind: "emailPassword" | "webhookSecret",
  input: SavedSecretInput,
  provider: WebhookProvider = "generic",
) {
  if (input.action === "replace") return input.value;
  const current = await ConfigRepo.getConfigSnapshot(context.db);
  if (current.notificationRevision !== input.expectedRevision)
    throw new ORPCError("CONFIG_CONFLICT", { status: 409 });
  const webhook = current.config.notification?.webhook;
  // A saved secret belongs to the channel it was saved for.
  if (kind === "webhookSecret" && (webhook?.provider ?? "generic") !== provider)
    throw new ORPCError("CONFIG_INVALID", { status: 400 });
  const value =
    kind === "emailPassword" ? current.config.email?.password : webhook?.secret;
  if (!value) throw new ORPCError("CONFIG_INVALID", { status: 400 });
  return value;
}

export async function uploadSiteAsset(
  context: { env: Env },
  input: { file: File; assetPath: string },
): Promise<{ url: string }> {
  const { url } = await Storage.putSiteAsset(
    context.env,
    input.file,
    input.assetPath,
  );

  const timestamp = Math.floor(Date.now() / 1000);
  const isFavicon = input.assetPath.startsWith("favicon/");
  const finalUrl = isFavicon
    ? `${url}?original=true&v=${timestamp}`
    : `${url}?v=${timestamp}`;

  return { url: finalUrl };
}
