import { UserRound } from "lucide-react";
import { useState } from "react";
export function CommentAvatar({
  name,
  image,
  deleted = false,
}: {
  name?: string | null;
  image?: string | null;
  deleted?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="comment-avatar">
      {!deleted && image && failed !== image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          onError={() => setFailed(image)}
        />
      ) : !deleted && name ? (
        <span>{name.slice(0, 1)}</span>
      ) : (
        <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />
      )}
    </span>
  );
}
