import { renderToStaticMarkup } from "react-dom/server";
import type { AuthType } from "worker-mailer";
import {
  resolveSiteConfig,
  resolveSystemConfig,
} from "@/features/config/config.resolve";
import * as ConfigRepo from "@/features/config/data/config.data";
import * as ConfigService from "@/features/config/service/config.service";
import * as EmailData from "@/features/email/data/email.data";
import * as kvStore from "@/features/cache/kv-store";
import {
  EmailTestRecordSchema,
  type EmailTestStatus,
  type TestEmailConnectionInput,
} from "@/features/email/email.schema";
import { verifyUnsubscribeToken } from "@/features/email/email.utils";
import { emailSiteOf } from "@/features/email/templates/email-theme";
import { TestEmail } from "@/features/email/templates/TestEmail";
import type { EmailUnsubscribeType } from "@/lib/db/schema";
import { isNotInProduction, serverEnv } from "@/lib/env/server.env";
import { err, ok } from "@/lib/errors";
import { m } from "@/paraglide/messages";

type ConfiguredEmailConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  senderAddress: string;
  senderName?: string;
};

function resolveTransportSecurity(port: number) {
  return {
    secure: port === 465,
    startTls: port !== 465,
  };
}

function getSmtpAuthTypes(): AuthType[] {
  return ["plain", "login", "cram-md5"];
}

export function isEmailConfigured(
  email:
    | {
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        senderAddress?: string;
        senderName?: string;
      }
    | null
    | undefined,
): email is ConfiguredEmailConfig {
  return !!(
    email?.host?.trim() &&
    email.port &&
    email.username?.trim() &&
    email.password?.trim() &&
    email.senderAddress?.trim()
  );
}

const EMAIL_TEST_RECORD_KEY = ["email", "last-test"] as const;

/**
 * Identifies a set of SMTP settings without storing the password: the same
 * settings tested and later saved produce the same fingerprint.
 */
async function emailSettingsFingerprint(settings: TestEmailConnectionInput) {
  const canonical = JSON.stringify([
    settings.host.trim(),
    settings.port,
    settings.username.trim(),
    settings.password,
    settings.senderAddress.trim(),
    settings.senderName?.trim() ?? "",
  ]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function recordEmailTest(
  context: BaseContext,
  settings: TestEmailConnectionInput,
  error: string | null,
) {
  await kvStore.put(
    context,
    EMAIL_TEST_RECORD_KEY,
    JSON.stringify({
      fingerprint: await emailSettingsFingerprint(settings),
      success: error === null,
      testedAt: new Date().toISOString(),
      error,
    }),
  );
}

function parseEmailTestRecord(stored: string | null) {
  if (!stored) return null;
  try {
    const parsed = EmailTestRecordSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The last test result, if it was run against the settings saved now. */
export async function getEmailTestStatus(
  context: DbContext,
): Promise<EmailTestStatus> {
  const untested = { state: "untested", testedAt: null, error: null } as const;
  const email = resolveSystemConfig(
    await ConfigRepo.getSystemConfig(context.db),
  ).email;
  if (!isEmailConfigured(email)) return untested;

  const record = parseEmailTestRecord(
    await kvStore.get(context, EMAIL_TEST_RECORD_KEY),
  );
  if (!record) return untested;

  if (record.fingerprint !== (await emailSettingsFingerprint(email))) {
    return untested;
  }
  return {
    state: record.success ? "verified" : "failed",
    testedAt: record.testedAt,
    error: record.error,
  };
}

export async function testEmailConnection(
  context: AuthContext,
  data: TestEmailConnectionInput,
) {
  try {
    const { LOCALE } = serverEnv(context.env);
    const { host, password, port, senderAddress, senderName, username } = data;
    const security = resolveTransportSecurity(port);
    const site = emailSiteOf(
      resolveSiteConfig(await ConfigRepo.getSystemConfig(context.db)),
    );

    const { WorkerMailer } = await import("worker-mailer");
    await WorkerMailer.send(
      {
        host,
        port,
        authType: getSmtpAuthTypes(),
        credentials: {
          username,
          password,
        },
        ...security,
      },
      {
        from: {
          name: senderName,
          email: senderAddress,
        },
        to: context.session.user.email,
        subject: m.settings_email_test_mail_subject({}, { locale: LOCALE }),
        html: renderToStaticMarkup(TestEmail({ locale: LOCALE, site })),
      },
    );

    await recordEmailTest(context, data, null);
    return ok({ success: true });
  } catch (error) {
    const locale = serverEnv(context.env).LOCALE;
    const errorMessage =
      error instanceof Error
        ? error.message
        : m.settings_email_unknown_error({}, { locale });
    console.error(
      JSON.stringify({
        message: "email test connection failed",
        host: data.host,
        port: data.port,
        username: data.username,
        senderAddress: data.senderAddress,
        error: errorMessage,
      }),
    );
    await recordEmailTest(context, data, errorMessage);
    return err({ reason: "SEND_FAILED", message: errorMessage });
  }
}

export async function unsubscribeByToken(
  context: DbContext,
  data: {
    userId: string;
    type: EmailUnsubscribeType;
    token: string;
  },
) {
  const { BETTER_AUTH_SECRET } = serverEnv(context.env);
  const isValid = await verifyUnsubscribeToken(
    BETTER_AUTH_SECRET,
    data.userId,
    data.type,
    data.token,
  );

  if (!isValid) {
    return err({ reason: "INVALID_OR_EXPIRED_TOKEN" });
  }

  await EmailData.unsubscribe(context.db, data.userId, data.type);
  return ok({ success: true });
}

export async function getReplyNotificationStatus(
  context: DbContext,
  userId: string,
) {
  const unsubscribed = await EmailData.isUnsubscribed(
    context.db,
    userId,
    "reply_notification",
  );
  return { enabled: !unsubscribed };
}

export async function toggleReplyNotification(
  context: DbContext,
  data: { userId: string; enabled: boolean },
) {
  if (data.enabled) {
    await EmailData.subscribe(context.db, data.userId, "reply_notification");
  } else {
    await EmailData.unsubscribe(context.db, data.userId, "reply_notification");
  }
  return { success: true };
}

export async function sendEmail(
  context: DbContext & { executionCtx: ExecutionContext },
  options: {
    to: string;
    subject: string;
    html: string;
    headers?: Record<string, string>;
    idempotencyKey?: string;
    unsubscribe?: {
      userId: string;
      type: EmailUnsubscribeType;
    };
  },
) {
  if (options.unsubscribe) {
    const unsubscribed = await EmailData.isUnsubscribed(
      context.db,
      options.unsubscribe.userId,
      options.unsubscribe.type,
    );

    if (unsubscribed) {
      console.log(
        JSON.stringify({
          event: "email_skipped",
          reason: "user_unsubscribed",
          to: options.to,
          userId: options.unsubscribe.userId,
          type: options.unsubscribe.type,
        }),
      );
      return ok({ success: true });
    }
  }

  if (isNotInProduction(context.env)) {
    console.log(
      `[EMAIL_SERVICE] 开发环境跳过发送至 ${options.to} 的邮件：${options.subject}:\n${options.html}`,
    );
    return ok({ success: true });
  }

  const config = await ConfigService.getSystemConfig(context);
  const email = config?.email;

  if (!isEmailConfigured(email)) {
    console.warn(`[EMAIL_SERVICE] 未配置邮件服务，跳过发送至: ${options.to}`);
    return err({ reason: "EMAIL_DISABLED" });
  }

  try {
    const security = resolveTransportSecurity(email.port);

    const { WorkerMailer } = await import("worker-mailer");
    await WorkerMailer.send(
      {
        host: email.host,
        port: email.port,
        authType: getSmtpAuthTypes(),
        credentials: {
          username: email.username,
          password: email.password,
        },
        ...security,
      },
      {
        from: {
          name: email.senderName,
          email: email.senderAddress,
        },
        to: options.to,
        subject: options.subject,
        html: options.html,
        headers: options.headers,
      },
    );
  } catch (error) {
    const locale = serverEnv(context.env).LOCALE;
    const errorMessage =
      error instanceof Error
        ? error.message
        : m.settings_email_unknown_error({}, { locale });
    console.error(
      JSON.stringify({
        message: "email send failed",
        host: email.host,
        port: email.port,
        to: options.to,
        subject: options.subject,
        error: errorMessage,
      }),
    );
    return err({
      reason: "SEND_FAILED",
      message: errorMessage,
    });
  }

  return ok({ success: true });
}
