import {
  hashPostPassword,
  readCookie,
  signPostAccess,
  verifyPostAccess,
  verifyPostPassword,
} from "@/features/posts/utils/post-access";

/** 日常沿用文章那套密码与 cookie 机制，只换 cookie 名与签名作用域。 */
export const hashMomentPassword = hashPostPassword;
export const verifyMomentPassword = verifyPostPassword;
export { readCookie };

export function momentAccessCookieName(momentId: number): string {
  return `moment_access_${momentId}`;
}

function scoped(hash: string): string {
  return `moment:${hash}`;
}

export function signMomentAccess(
  secret: string,
  momentId: number,
  passwordHash: string,
): Promise<string> {
  return signPostAccess(secret, momentId, scoped(passwordHash));
}

export function verifyMomentAccess(
  secret: string,
  momentId: number,
  passwordHash: string,
  token: string | undefined,
): Promise<boolean> {
  return verifyPostAccess(secret, momentId, scoped(passwordHash), token);
}
