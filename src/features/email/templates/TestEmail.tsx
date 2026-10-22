import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import { EmailHeading, EmailLayout, EmailText } from "./EmailLayout";
import type { EmailSite } from "./email-theme";

export const TestEmail = ({
  locale,
  site,
}: {
  locale: Locale;
  site: EmailSite;
}) => {
  const title = m.settings_email_test_mail_subject({}, { locale });
  return (
    <EmailLayout locale={locale} previewText={title} site={site}>
      <EmailHeading>{title}</EmailHeading>
      <EmailText>{m.settings_email_test_mail_body({}, { locale })}</EmailText>
    </EmailLayout>
  );
};
