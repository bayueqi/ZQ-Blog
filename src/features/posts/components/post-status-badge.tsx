import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

export function PostStatusBadge({
  published,
  scheduled = false,
}: {
  published: boolean;
  /** 已发布但还没到发布时间，也就是定时发布中。 */
  scheduled?: boolean;
}) {
  if (scheduled) {
    return <Badge tone="warning">{m.admin_posts_status_scheduled()}</Badge>;
  }

  return (
    <Badge tone={published ? "success" : "neutral"}>
      {published
        ? m.admin_posts_status_published()
        : m.admin_posts_status_draft()}
    </Badge>
  );
}
