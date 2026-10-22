/** Password hashing and unlock tokens for password-protected posts. */

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/** Stored form: sha256$<salt>$<hex>. Plain passwords never reach the database. */
export async function hashPostPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  return `sha256$${salt}$${await sha256Hex(`${salt}:${password}`)}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPostPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "sha256" || !salt || !expected) return false;
  return timingSafeEqual(await sha256Hex(`${salt}:${password}`), expected);
}

export function postAccessCookieName(postId: number): string {
  return `post_access_${postId}`;
}

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

function base64Url(buffer: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmac(secret: string, payload: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
}

/** Tied to the current hash, so changing the password drops every old cookie. */
export async function signPostAccess(
  secret: string,
  postId: number,
  passwordHash: string,
): Promise<string> {
  return base64Url(await hmac(secret, `${postId}:${passwordHash}`));
}

export async function verifyPostAccess(
  secret: string,
  postId: number,
  passwordHash: string,
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const expected = await signPostAccess(secret, postId, passwordHash);
  return timingSafeEqual(token, expected);
}
