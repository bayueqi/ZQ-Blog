/** A piece of content a Comment can hang on. */
export type CommentTargetRef =
  | { targetType: "post"; slug: string }
  | { targetType: "moment"; momentId: number }
  | { targetType: "gallery"; slug: string };

/** The content page itself, before jumping to a single Comment. */
export function targetPagePath(target: CommentTargetRef): string {
  if (target.targetType === "post") return `/post/${target.slug}`;
  if (target.targetType === "gallery") return `/gallery/${target.slug}`;
  return `/moments#moment-${target.momentId}`;
}

/**
 * Where a reader lands after following a comment link.
 *
 * Posts and gallery categories keep every Comment in one section at the end of
 * the page, so `#comments` scrolls straight there. Moments are a timeline and
 * each one hides its Comments until opened, so the anchor has to name that very
 * moment instead.
 */
export function publicCommentPath(
  target: CommentTargetRef,
  commentId: number,
): string {
  if (target.targetType === "moment") {
    return `/moments?comment=${commentId}#moment-${target.momentId}`;
  }
  return `${targetPagePath(target)}?comment=${commentId}#comments`;
}
