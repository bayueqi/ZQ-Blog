import {
  hashPostPassword,
  readCookie,
  signPostAccess,
  verifyPostAccess,
  verifyPostPassword,
} from "@/features/posts/utils/post-access";

/** 相册集沿用文章那套密码与 cookie 机制，只是换了 cookie 名和作用域。 */
export const hashGalleryPassword = hashPostPassword;
export const verifyGalleryPassword = verifyPostPassword;
export { readCookie };

export function galleryAccessCookieName(categoryId: number): string {
  return `gallery_access_${categoryId}`;
}

// 加个前缀，跟文章用的令牌区分开，避免同 id 同密码时互相通用。
function scoped(hash: string): string {
  return `gallery:${hash}`;
}

export function signGalleryAccess(
  secret: string,
  categoryId: number,
  passwordHash: string,
): Promise<string> {
  return signPostAccess(secret, categoryId, scoped(passwordHash));
}

export function verifyGalleryAccess(
  secret: string,
  categoryId: number,
  passwordHash: string,
  token: string | undefined,
): Promise<boolean> {
  return verifyPostAccess(secret, categoryId, scoped(passwordHash), token);
}
