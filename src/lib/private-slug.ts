/**
 * 私密内容对外的名字：只报编号，不报真实标题。
 *
 * 真实 slug 由标题生成，出现在链接里等于把标题说出去，所以上锁期间对外
 * 一律用「私密文章-3」这样的占位链接；解锁后再跳到真实链接。
 */
export const PRIVATE_SLUG_PREFIX = {
  post: "私密文章",
  gallery: "私密相册",
} as const;

export function formatPrivateSlug(prefix: string, index: number) {
  return `${prefix}-${index}`;
}

/** 取占位链接末尾的编号；不是占位链接就返回 null。 */
export function parsePrivateIndex(
  slug: string | null | undefined,
): number | null {
  const matched = /-(\d+)$/.exec(slug ?? "");
  return matched ? Number(matched[1]) : null;
}

/** 界面上显示的编号，取不到就当成第 1 个。 */
export function privateLabelIndex(slug: string | null | undefined) {
  return parsePrivateIndex(slug) ?? 1;
}

export function isPrivateSlug(
  slug: string | null | undefined,
  prefix: string,
): boolean {
  if (!slug) return false;
  return slug.startsWith(`${prefix}-`) && parsePrivateIndex(slug) != null;
}

/** 已用的占位链接里最大的编号，新内容接着往后排。 */
export function nextPrivateIndex(slugs: Array<string | null | undefined>) {
  return slugs.reduce((max, slug) => {
    const index = parsePrivateIndex(slug);
    return index != null && index > max ? index : max;
  }, 0);
}
