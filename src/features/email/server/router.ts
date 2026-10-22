import { CONFIG_ERRORS } from "@/features/config/config.admin.schema";
import { z } from "zod";
import * as ConfigService from "@/features/config/service/config.service";
import { AdminTestEmailConnectionSchema } from "@/features/email/email.schema";
import * as EmailService from "@/features/email/service/email.service";
import * as AuthService from "@/features/auth/service/auth.service";
import { EMAIL_UNSUBSCRIBE_TYPES } from "@/lib/db/schema";
import {
  adminProcedure,
  authProcedure,
  publicProcedure,
} from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const emailErrors = {
  SEND_FAILED: { status: 400, message: "Failed to send test email." },
  INVALID_OR_EXPIRED_TOKEN: {
    status: 400,
    message: "Unsubscribe token is invalid or expired.",
  },
  EMAIL_DISABLED: { status: 400, message: "Email notifications are disabled." },
} as const;

const configured = publicProcedure
  .route({
    method: "GET",
    path: "/email/configured",
    summary: "Check if email is configured",
    tags: ["Email"],
  })
  .handler(({ context }) => AuthService.getIsEmailConfigured(context));

const unsubscribe = publicProcedure
  .errors(emailErrors)
  .route({
    method: "POST",
    path: "/email/unsubscribe",
    summary: "Unsubscribe from email notifications",
    tags: ["Email"],
  })
  .input(
    z.object({
      userId: z.string(),
      type: z.enum(EMAIL_UNSUBSCRIBE_TYPES),
      token: z.string(),
    }),
  )
  .handler(({ context, input, errors }) =>
    unwrapResult(EmailService.unsubscribeByToken(context, input), {
      INVALID_OR_EXPIRED_TOKEN: () => {
        throw errors.INVALID_OR_EXPIRED_TOKEN();
      },
    }),
  );

const replyStatus = authProcedure
  .route({
    method: "GET",
    path: "/me/notifications/reply",
    summary: "Get reply notification status",
    tags: ["Email"],
  })
  .handler(({ context }) =>
    EmailService.getReplyNotificationStatus(context, context.session.user.id),
  );

const availability = authProcedure
  .route({
    method: "GET",
    path: "/me/notifications/availability",
    summary: "Get notification availability",
    tags: ["Email"],
  })
  .handler(async ({ context }) => {
    const config = await ConfigService.getSystemConfig(context);
    return {
      emailEnabled: config?.notification?.user?.emailEnabled ?? true,
    };
  });

const toggleReply = authProcedure
  .errors(emailErrors)
  .route({
    method: "PATCH",
    path: "/me/notifications/reply",
    summary: "Toggle reply notifications",
    tags: ["Email"],
  })
  .input(z.object({ enabled: z.boolean() }))
  .handler(({ context, input }) =>
    EmailService.toggleReplyNotification(context, {
      userId: context.session.user.id,
      enabled: input.enabled,
    }),
  );

const testConnection = adminProcedure
  .errors({ ...emailErrors, ...CONFIG_ERRORS })
  .route({
    method: "POST",
    path: "/admin/email/test",
    summary: "Send a test email",
    description:
      "Tests the supplied connection without saving settings. The secret accepts replace with a new value or keep with the notification section expectedRevision; keep resolves the saved secret server-side and rejects stale revisions with CONFIG_CONFLICT. Saved secrets are never returned.",
    tags: ["Admin Email"],
  })
  .input(AdminTestEmailConnectionSchema)
  .handler(async ({ context, input, errors }) => {
    const result = await EmailService.testEmailConnection(context, {
      ...input,
      password: await ConfigService.resolveTestSecret(
        context,
        "emailPassword",
        input.password,
      ),
    });
    if (result.error) {
      // The SMTP error tells the Admin what to fix, so pass it through.
      throw errors.SEND_FAILED({ message: result.error.message });
    }
    return result.data;
  });

const testStatus = adminProcedure
  .route({
    method: "GET",
    path: "/admin/email/test-status",
    summary: "Get the last email test result for the saved settings",
    description:
      "Returns verified or failed when the last test used exactly the saved email settings, and untested otherwise.",
    tags: ["Admin Email"],
  })
  .handler(({ context }) => EmailService.getEmailTestStatus(context));

const hasPassword = authProcedure
  .route({
    method: "GET",
    path: "/me/has-password",
    summary: "Check if the current user has a password",
    tags: ["Auth"],
  })
  .handler(({ context }) => AuthService.userHasPassword(context));

export default {
  configured,
  testStatus,
  unsubscribe,
  replyStatus,
  availability,
  toggleReply,
  testConnection,
  hasPassword,
};
