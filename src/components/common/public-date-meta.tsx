import { Calendar, Edit } from "lucide-react";
import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import { cn } from "@/lib/utils";

interface PublicDateMetaProps {
  publishedAt: string | Date | null | undefined;
  updatedAt?: string | Date | null;
  className?: string;
}

/** 与文章页一致的发布、修改时间；日常和相册共用这一套。 */
export function PublicDateMeta({
  publishedAt,
  updatedAt,
  className,
}: PublicDateMetaProps) {
  if (!publishedAt) return null;

  const published = new Date(publishedAt);
  const updated = updatedAt ? new Date(updatedAt) : null;
  const isUpdated = Boolean(
    updated &&
      !Number.isNaN(updated.getTime()) &&
      updated.getTime() !== published.getTime(),
  );

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}
    >
      <div className="flex items-center">
        <div className="fuwari-meta-icon">
          <Calendar strokeWidth={1.5} size={20} />
        </div>
        <time
          dateTime={published.toISOString()}
          className="text-sm font-medium fuwari-text-50"
        >
          {formatPublicPostDate(published)}
        </time>
      </div>

      {isUpdated && updated ? (
        <div className="flex items-center">
          <div className="fuwari-meta-icon">
            <Edit strokeWidth={1.5} size={20} />
          </div>
          <time
            dateTime={updated.toISOString()}
            className="text-sm font-medium fuwari-text-50"
          >
            {formatPublicPostDate(updated)}
          </time>
        </div>
      ) : null}
    </div>
  );
}
