import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailPanel,
  EmailText,
} from "./EmailLayout";
import type { EmailSite } from "./email-theme";

interface FriendLinkAdminNotificationEmailProps {
  description: string;
  locale: Locale;
  reviewUrl: string;
  site: EmailSite;
  siteName: string;
  siteUrl: string;
  submitterName: string;
}

export const FriendLinkAdminNotificationEmail = ({
  description,
  locale,
  reviewUrl,
  site,
  siteName,
  siteUrl,
  submitterName,
}: FriendLinkAdminNotificationEmailProps) => {
  return (
    <EmailLayout
      locale={locale}
      site={site}
      previewText={m.email_friend_link_submitted_preview(
        { submitterName, siteName },
        { locale },
      )}
    >
      <EmailHeading>
        {m.email_friend_link_submitted_title({}, { locale })}
      </EmailHeading>
      <EmailText>
        {m.email_friend_link_submitted_intro({ submitterName }, { locale })}
      </EmailText>
      <EmailPanel>
        <strong>
          {m.email_friend_link_submitted_site_name({}, { locale })}
        </strong>
        {siteName}
        <br />
        <strong>
          {m.email_friend_link_submitted_site_url({}, { locale })}
        </strong>
        <EmailLink href={siteUrl}>{siteUrl}</EmailLink>
        {description && (
          <>
            <br />
            <strong>
              {m.email_friend_link_submitted_description({}, { locale })}
            </strong>
            {description}
          </>
        )}
      </EmailPanel>
      <EmailButton href={reviewUrl}>
        {m.email_friend_link_submitted_action({}, { locale })}
      </EmailButton>
    </EmailLayout>
  );
};
