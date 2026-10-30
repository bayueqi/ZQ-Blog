import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailPanel,
  EmailText,
} from "./EmailLayout";
import type { EmailSite } from "./email-theme";

interface AdminNotificationEmailProps {
  commentPreview: string;
  commentUrl: string;
  commenterName: string;
  locale: Locale;
  targetLabel: string;
  site: EmailSite;
}

export const AdminNotificationEmail = ({
  commentPreview,
  commentUrl,
  commenterName,
  locale,
  targetLabel,
  site,
}: AdminNotificationEmailProps) => {
  return (
    <EmailLayout
      locale={locale}
      site={site}
      previewText={m.email_comment_admin_root_preview(
        { commenterName, targetLabel },
        { locale },
      )}
    >
      <EmailHeading>
        {m.email_comment_admin_root_title({}, { locale })}
      </EmailHeading>
      <EmailText>
        {m.email_comment_admin_root_intro(
          { commenterName, targetLabel },
          { locale },
        )}
      </EmailText>
      <EmailPanel>{commentPreview}</EmailPanel>
      <EmailButton href={commentUrl}>
        {m.email_comment_admin_root_action({}, { locale })}
      </EmailButton>
    </EmailLayout>
  );
};
