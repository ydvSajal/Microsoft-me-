// Account crypto (T-45), pure so it is tested without a DB. Sessions and cookies live in lib/session.ts.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const IV_BYTES = 12;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Random URL-safe token: session cookies, OAuth state, Telegram link tokens. */
export const newToken = () => randomBytes(TOKEN_BYTES).toString("base64url");

/** "salt:hash" in hex. scrypt's defaults (N=16384) are fine for a 20-account app. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  return `${salt.toString("hex")}:${scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "hex");
  const got = scryptSync(password, Buffer.from(salt, "hex"), want.length);
  return want.length === SCRYPT_KEYLEN && timingSafeEqual(got, want);
}

/** A dummy hash so a login for an unknown email costs the same scrypt time as a real one. */
export const DUMMY_HASH = hashPassword(newToken());

const key = (secret: string) => createHash("sha256").update(secret).digest();

/** AES-256-GCM: "iv.tag.ciphertext" in base64url. Used for the GitHub token at rest. */
export function seal(plain: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** null when the value was tampered with or sealed under another secret. */
export function unseal(sealed: string, secret: string): string | null {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(secret), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const Credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

/** Only same-site paths survive as a post-login redirect (no open redirects). */
export const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/dashboard";
