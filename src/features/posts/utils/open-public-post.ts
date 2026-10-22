/** Opens a post's live page, the one at its public slug, in a new tab. */
export function openPublicPost(publicSlug: string) {
  window.open(`/post/${encodeURIComponent(publicSlug)}`, "_blank", "noopener");
}
