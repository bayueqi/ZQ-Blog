import * as AuthData from "@/features/auth/data/auth.data";
import { resolveSiteConfig } from "@/features/config/config.resolve";
import * as ConfigService from "@/features/config/service/config.service";
import { createEmailMessageFromNotification } from "@/features/email/service/email-message.mapper";
import {
  emailSiteOf,
  type EmailSite,
} from "@/features/email/templates/email-theme";
import type {
  NotificationDelivery,
  NotificationEvent,
} from "@/features/notification/notification.schema";
import {
  ADMIN_NOTIFICATION_EVENTS,
  notificationEventSchema,
  USER_NOTIFICATION_EVENTS,
} from "@/features/notification/notification.schema";
import { missingWebhookField } from "@/features/webhook/webhook.providers";
import type { WebhookEndpoint } from "@/features/webhook/webhook.schema";
import { serverEnv } from "@/lib/env/server.env";

function isAdminNotificationEvent(
  event: NotificationEvent,
): event is Extract<
  NotificationEvent,
  { type: (typeof ADMIN_NOTIFICATION_EVENTS)[number] }
> {
  return ADMIN_NOTIFICATION_EVENTS.some((type) => type === event.type);
}

function isUserNotificationEvent(
  event: NotificationEvent,
): event is Extract<
  NotificationEvent,
  { type: (typeof USER_NOTIFICATION_EVENTS)[number] }
> {
  return USER_NOTIFICATION_EVENTS.some((type) => type === event.type);
}

function configuredWebhookEndpoint(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
): WebhookEndpoint | null {
  const endpoint = config?.notification?.webhook;
  if (!endpoint || missingWebhookField(endpoint)) return null;
  return {
    ...endpoint,
    url: endpoint.url.trim(),
    secret: endpoint.secret.trim(),
  };
}

async function enqueueEmailNotification(
  context: DbContext,
  event: NotificationEvent,
  delivery: NotificationDelivery,
  site: EmailSite,
) {
  const emailMessage = createEmailMessageFromNotification(
    event,
    { locale: serverEnv(context.env).LOCALE, site },
    delivery,
  );
  await context.env.QUEUE.send({
    type: "EMAIL",
    data: emailMessage,
  });
}

async function enqueueWebhookNotification(
  context: DbContext,
  event: Extract<
    NotificationEvent,
    { type: (typeof ADMIN_NOTIFICATION_EVENTS)[number] }
  >,
  endpoint: WebhookEndpoint,
) {
  await context.env.QUEUE.send({
    type: "WEBHOOK",
    data: { ...endpoint, event },
  });
}

export async function publishNotificationEvent(
  context: DbContext & { executionCtx: ExecutionContext },
  event: NotificationEvent,
  delivery?: NotificationDelivery,
) {
  const parsed = notificationEventSchema.parse(event);
  const config = await ConfigService.getSystemConfig(context);
  const adminEmailEnabled =
    config?.notification?.admin?.channels?.email ?? true;
  const userEmailEnabled = config?.notification?.user?.emailEnabled ?? true;
  const webhookEndpoint = configuredWebhookEndpoint(config);
  const site = emailSiteOf(resolveSiteConfig(config));

  if (isUserNotificationEvent(parsed)) {
    if (!userEmailEnabled || !delivery?.to) {
      return;
    }

    await enqueueEmailNotification(context, parsed, delivery, site);
    console.log(
      JSON.stringify({
        level: "info",
        message: "Notification published",
        eventType: parsed.type,
        deliveries: { email: true },
      }),
    );
    return;
  }

  if (isAdminNotificationEvent(parsed)) {
    const deliveries: Array<Promise<void>> = [];
    let emailed = false;

    if (adminEmailEnabled) {
      const to = delivery?.to ?? (await AuthData.findAdminEmail(context.db));
      if (to) {
        deliveries.push(
          enqueueEmailNotification(
            context,
            parsed,
            { to, unsubscribeUrl: delivery?.unsubscribeUrl },
            site,
          ),
        );
        emailed = true;
      }
    }

    if (webhookEndpoint) {
      deliveries.push(
        enqueueWebhookNotification(context, parsed, webhookEndpoint),
      );
    }

    console.log(
      JSON.stringify({
        level: "info",
        message: "Notification published",
        eventType: parsed.type,
        deliveries: {
          email: emailed,
          webhook: Boolean(webhookEndpoint),
        },
      }),
    );
    await Promise.all(deliveries);
    return;
  }

  parsed satisfies never;
}
