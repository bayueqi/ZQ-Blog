import { seedSystemConfig } from "tests/config-fixture";
import { createAdminTestContext, seedUser } from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/features/config/config.schema";
import * as EmailService from "./service/email.service";

const send = vi.hoisted(() => vi.fn());
vi.mock("worker-mailer", () => ({ WorkerMailer: { send } }));

const SAVED = {
  host: "smtp.example.com",
  port: 465,
  username: "blog@example.com",
  password: "app-password",
  senderAddress: "blog@example.com",
  senderName: "Blog",
};

describe("email test status", () => {
  let context: ReturnType<typeof createAdminTestContext>;

  beforeEach(async () => {
    send.mockReset();
    context = createAdminTestContext();
    await seedUser(context.db, context.session.user);
    await seedSystemConfig(context, { ...DEFAULT_CONFIG, email: SAVED });
  });

  it("is untested before any test", async () => {
    expect(await EmailService.getEmailTestStatus(context)).toMatchObject({
      state: "untested",
    });
  });

  it("remembers a passing test of the saved settings", async () => {
    send.mockResolvedValue(undefined);
    await EmailService.testEmailConnection(context, SAVED);

    expect(await EmailService.getEmailTestStatus(context)).toMatchObject({
      state: "verified",
      error: null,
    });
  });

  it("remembers a failing test with its reason", async () => {
    send.mockRejectedValue(new Error("535 Authentication failed"));
    const result = await EmailService.testEmailConnection(context, SAVED);

    expect(result.error).toEqual({
      reason: "SEND_FAILED",
      message: "535 Authentication failed",
    });
    expect(await EmailService.getEmailTestStatus(context)).toMatchObject({
      state: "failed",
      error: "535 Authentication failed",
    });
  });

  it("does not apply a test of other settings until they are saved", async () => {
    send.mockResolvedValue(undefined);
    const next = { ...SAVED, host: "smtp.other.example.com" };
    await EmailService.testEmailConnection(context, next);

    expect(await EmailService.getEmailTestStatus(context)).toMatchObject({
      state: "untested",
    });

    await seedSystemConfig(context, { ...DEFAULT_CONFIG, email: next });
    expect(await EmailService.getEmailTestStatus(context)).toMatchObject({
      state: "verified",
    });
  });
});
