import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailNote,
  EmailPanel,
  EmailText,
} from "./EmailLayout";
import type { EmailSite } from "./email-theme";

interface FriendLinkResultNotificationEmailProps {
  approved: boolean;
  blogUrl?: string;
  locale: Locale;
  rejectionReason?: string;
  site: EmailSite;
  siteName: string;
}

export const FriendLinkResultNotificationEmail = ({
  approved,
  blogUrl,
  locale,
  rejectionReason,
  site,
  siteName,
}: FriendLinkResultNotificationEmailProps) => {
  return (
    <EmailLayout
      locale={locale}
      site={site}
      previewText={
        approved
          ? m.email_friend_link_approved_preview({ siteName }, { locale })
          : m.email_friend_link_rejected_preview({ siteName }, { locale })
      }
    >
      <EmailHeading>
        {m.email_friend_link_result_title({}, { locale })}
      </EmailHeading>
      {approved ? (
        <>
          <EmailText>
            {m.email_friend_link_approved_body({ siteName }, { locale })}
          </EmailText>
          {blogUrl && (
            <EmailButton href={blogUrl}>
              {m.email_friend_link_approved_action({}, { locale })}
            </EmailButton>
          )}
        </>
      ) : (
        <>
          <EmailText>
            {m.email_friend_link_rejected_body({ siteName }, { locale })}
          </EmailText>
          {rejectionReason && <EmailPanel>{rejectionReason}</EmailPanel>}
          <EmailNote>
            {m.email_friend_link_rejected_followup({}, { locale })}
          </EmailNote>
        </>
      )}
    </EmailLayout>
  );
};
