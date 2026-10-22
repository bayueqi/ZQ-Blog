import { SavedSecretInputSchema } from "@/features/config/config.admin.schema";
import { z } from "zod";

const TestEmailConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
  senderAddress: z.email(),
  senderName: z.string().optional(),
});

export type TestEmailConnectionInput = z.infer<
  typeof TestEmailConnectionSchema
>;

export const AdminTestEmailConnectionSchema = TestEmailConnectionSchema.omit({
  password: true,
})
  .extend({ password: SavedSecretInputSchema })
  .strict();
export type AdminTestEmailConnectionInput = z.infer<
  typeof AdminTestEmailConnectionSchema
>;

/** The last SMTP test, kept server-side so it survives leaving the page. */
export const EmailTestRecordSchema = z.object({
  fingerprint: z.string(),
  success: z.boolean(),
  testedAt: z.iso.datetime(),
  error: z.string().nullable(),
});
export type EmailTestRecord = z.infer<typeof EmailTestRecordSchema>;

/** Whether the saved email settings are the ones last tested. */
export const EmailTestStatusSchema = z.object({
  state: z.enum(["untested", "verified", "failed"]),
  testedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});
export type EmailTestStatus = z.infer<typeof EmailTestStatusSchema>;
