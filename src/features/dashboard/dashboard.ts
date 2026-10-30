import { blogConfig } from "@/blog.config";
import { jsonCommentToPlainText } from "@/features/comments/comment-body";
import type { SystemConfig } from "@/features/config/config.schema";
import { isEmailConfigured } from "@/features/email/service/email.service";
import { DASHBOARD_WRITING_WEEKS } from "@/features/dashboard/writing-calendar";

export const DASHBOARD_RECENT_EDITS_LIMIT = 5;
export const DASHBOARD_PENDING_FRIEND_LINKS_LIMIT = 5;
export const DASHBOARD_UNREPLIED_COMMENTS_LIMIT = 5;
export const DASHBOARD_RECENT_COMMENT_DAYS = 7;
/** Every day the calendar can show, plus one for any time zone's offset. */
export const DASHBOARD_WRITING_LOOKBACK_DAYS = DASHBOARD_WRITING_WEEKS * 7 + 1;
const DASHBOARD_COMMENT_SNIPPET_LENGTH = 80;

export function adminEmailNeedsSetup(config: SystemConfig): boolean {
  const adminEmailEnabled = config.notification?.admin?.channels?.email ?? true;
  if (!adminEmailEnabled) return false;
  return !isEmailConfigured(config.email);
}

export function siteIdentityIsDefault(
  site: SystemConfig["site"] | undefined,
): boolean {
  const title = site?.title?.trim() ?? "";
  const author = site?.author?.trim() ?? "";
  return title === blogConfig.title || author === blogConfig.author;
}

export function commentSnippet(
  content: unknown,
  maxLength = DASHBOARD_COMMENT_SNIPPET_LENGTH,
): string {
  const plain = jsonCommentToPlainText(content).replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}
