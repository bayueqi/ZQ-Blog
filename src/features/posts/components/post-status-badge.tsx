import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

export function PostStatusBadge({ published }: { published: boolean }) {
  return (
    <Badge tone={published ? "success" : "neutral"}>
      {published
        ? m.admin_posts_status_published()
        : m.admin_posts_status_draft()}
    </Badge>
  );
}
