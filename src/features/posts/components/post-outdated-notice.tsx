import { History } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import { m } from "@/paraglide/messages";

const OUTDATED_AFTER_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

interface PostOutdatedNoticeProps {
  publishedAt: Date | null;
  updatedAt: Date;
}

/** Warns readers that a post has gone a long time without an update. */
export function PostOutdatedNotice({
  publishedAt,
  updatedAt,
}: PostOutdatedNoticeProps) {
  const lastChanged =
    publishedAt && publishedAt > updatedAt ? publishedAt : updatedAt;
  const days = Math.floor((Date.now() - lastChanged.getTime()) / DAY_MS);
  if (days < OUTDATED_AFTER_DAYS) return null;

  return (
    <Callout tone="warning" icon={History} className="mb-6">
      {/* A cached page can be a day behind the client's clock. */}
      <p suppressHydrationWarning>
        {m.post_outdated_notice({
          date: formatPublicPostDate(lastChanged),
          days,
        })}
      </p>
    </Callout>
  );
}
