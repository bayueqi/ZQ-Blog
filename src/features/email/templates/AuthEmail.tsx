import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailNote,
  EmailText,
} from "./EmailLayout";
import type { EmailSite } from "./email-theme";

interface AuthEmailProps {
  locale: Locale;
  site: EmailSite;
  type: "verification" | "reset-password";
  url: string;
}

export const AuthEmail = ({ locale, site, type, url }: AuthEmailProps) => {
  const isVerification = type === "verification";
  const title = isVerification
    ? m.email_auth_verification_subject({}, { locale })
    : m.email_auth_reset_subject({}, { locale });
  const description = isVerification
    ? m.email_auth_verification_desc({}, { locale })
    : m.email_auth_reset_desc({}, { locale });
  const buttonText = isVerification
    ? m.email_auth_verification_action({}, { locale })
    : m.email_auth_reset_action({}, { locale });

  return (
    <EmailLayout locale={locale} previewText={title} site={site}>
      <EmailHeading>{title}</EmailHeading>
      <EmailText>{description}</EmailText>
      <EmailButton href={url}>{buttonText}</EmailButton>
      <EmailNote>
        {m.email_auth_link_fallback({}, { locale })}
        <br />
        <EmailLink href={url}>{url}</EmailLink>
      </EmailNote>
      <EmailNote>{m.email_auth_expiry_notice({}, { locale })}</EmailNote>
    </EmailLayout>
  );
};
