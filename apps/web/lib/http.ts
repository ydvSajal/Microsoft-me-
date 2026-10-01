import { createHash, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { MAX_BODY_BYTES } from "./config";

export type ApiError = { error: { code: string; message: string; fields?: Record<string, string[]> } };

export const jsonError = (status: number, code: string, message: string, fields?: Record<string, string[]>) =>
  Response.json({ error: { code, message, ...(fields ? { fields } : {}) } } satisfies ApiError, { status });

/** Constant-time string compare; hashing first makes unequal lengths safe too. */
export function safeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** null when `header` carries `expected` as a token; otherwise the 401 to return. Unset secret → deny. */
export function requireToken(
  header: string | null,
  expected: string | undefined,
  scheme = "Bearer ",
): Response | null {
  const token = header?.startsWith(scheme) ? header.slice(scheme.length) : null;
  if (!expected || !token || !safeEqual(token, expected))
    return jsonError(401, "unauthorized", "Missing or wrong credentials.");
  return null;
}

export const requireIngestAuth = (req: Request) =>
  requireToken(req.headers.get("authorization"), process.env.SIFT_INGEST_SECRET);

/** Reads at most MAX_BODY_BYTES; stops reading as soon as the cap is passed. */
async function readCapped(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Parse and validate a JSON body: 413 over the cap, 400 with field errors when invalid. */
export async function readBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  const text = await readCapped(req);
  if (text === null)
    return { ok: false, res: jsonError(413, "too_large", `Body is over ${MAX_BODY_BYTES} bytes.`) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: jsonError(400, "bad_json", "Body is not valid JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "(root)";
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    return { ok: false, res: jsonError(400, "invalid", "Body failed validation.", fields) };
  }
  return { ok: true, data: parsed.data };
}
