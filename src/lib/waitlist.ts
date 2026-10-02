import { ensureSchema, getPool, usingDatabase, DB_SCHEMA } from "@/lib/db";
import { clientIpFromHeaders, consumeRateLimit, type RateLimitDecision } from "@/lib/rate-limit";

/** Public marketing waitlist body cap — an email signup is a few hundred bytes. */
export const WAITLIST_MAX_BYTES = 4096;

const LOCAL_RE = /^[a-z0-9](?:[a-z0-9.!#$%&'*+/=?^_`{|}~-]{0,62}[a-z0-9])?$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export type WaitlistPlatform = "ios" | "android";

export type WaitlistRow = {
  email: string;
  platforms: WaitlistPlatform[];
  source: string;
};

export type WaitlistParse =
  | ({ ok: true; honeypot: boolean } & WaitlistRow)
  | { ok: false; error: "invalid_email" | "invalid_body" };

type HeaderBag = { get(name: string): string | null };

export type WaitlistStore = (row: WaitlistRow) => Promise<"db" | "memory">;

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) return fallback;
  return n;
}

/**
 * Strict defaults outside local dev / unit tests. Override with WAITLIST_* env.
 * Limits are per server process (see rate-limit.ts).
 */
export function waitlistLimits(): {
  ipLimit: number;
  ipWindowMs: number;
  globalLimit: number;
  globalWindowMs: number;
  emailLimit: number;
  emailWindowMs: number;
} {
  const relaxed = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  return {
    ipLimit: intEnv("WAITLIST_IP_LIMIT", relaxed ? 100 : 10),
    ipWindowMs: intEnv("WAITLIST_IP_WINDOW_SEC", 600) * 1000,
    globalLimit: intEnv("WAITLIST_GLOBAL_LIMIT", relaxed ? 10_000 : 300),
    globalWindowMs: intEnv("WAITLIST_GLOBAL_WINDOW_SEC", 600) * 1000,
    emailLimit: intEnv("WAITLIST_EMAIL_LIMIT", relaxed ? 100 : 8),
    emailWindowMs: intEnv("WAITLIST_EMAIL_WINDOW_SEC", 3600) * 1000,
  };
}

/** ASCII mailbox: one @, dotted domain, TLD of at least 2, no quoted locals. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (email.includes("..") || /\s/.test(email)) return null;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || domain.length > 253) return null;
  if (!LOCAL_RE.test(local)) return null;
  if (domain.endsWith(".")) return null;
  const labels = domain.split(".");
  if (labels.length < 2) return null;
  if (labels.some((label) => !LABEL_RE.test(label))) return null;
  if (labels[labels.length - 1].length < 2) return null;
  return email;
}

export function normalizePlatforms(raw: unknown): WaitlistPlatform[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: WaitlistPlatform[] = [];
  for (const item of raw.slice(0, 8)) {
    if (typeof item !== "string") continue;
    const platform = item.trim().toLowerCase();
    if ((platform === "ios" || platform === "android") && !out.includes(platform)) {
      out.push(platform);
    }
  }
  return out;
}

/** Unknown or hostile source strings become the marketing default. */
export function normalizeSource(raw: unknown): string {
  if (typeof raw !== "string") return "coming-soon";
  const source = raw.trim().toLowerCase().slice(0, 64);
  return SOURCE_RE.test(source) ? source : "coming-soon";
}

function honeypotTripped(body: Record<string, unknown>): boolean {
  for (const key of ["bot-field", "botField", "company"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim().length > 0) return true;
  }
  return false;
}

export function parseWaitlistBody(raw: unknown): WaitlistParse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_body" };
  }
  const body = raw as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  if (!email) return { ok: false, error: "invalid_email" };
  const platforms = normalizePlatforms(body.platforms);
  if (!platforms) return { ok: false, error: "invalid_body" };
  return {
    ok: true,
    honeypot: honeypotTripped(body),
    email,
    platforms,
    source: normalizeSource(body.source),
  };
}

export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mime = value.split(";")[0]?.trim().toLowerCase();
  return mime === "application/json";
}

export async function readLimitedBody(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; error: "payload_too_large" }> {
  const declared = req.headers.get("content-length");
  if (declared) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > maxBytes) return { ok: false, error: "payload_too_large" };
  }
  if (!req.body) {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, error: "payload_too_large" };
    return { ok: true, text };
  }
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return { ok: false, error: "payload_too_large" };
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8", { fatal: false }).decode(buf) };
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function rateLimited(decision: RateLimitDecision, scope: "ip" | "global" | "email"): Response {
  console.warn(JSON.stringify({ event: "launch_notify.rate_limited", scope, retryAfterSec: decision.retryAfterSec }));
  return json(
    { error: "rate_limited", retryAfter: decision.retryAfterSec },
    429,
    { "Retry-After": String(decision.retryAfterSec) },
  );
}

async function defaultStore(row: WaitlistRow): Promise<"db" | "memory"> {
  if (!usingDatabase()) {
    console.log(JSON.stringify({ event: "launch_notify.dev", email: row.email, platforms: row.platforms, source: row.source }));
    return "memory";
  }
  await ensureSchema();
  await getPool().query(
    `INSERT INTO ${DB_SCHEMA}.launch_notify (email, platforms, source, updated_at)
     VALUES ($1, $2::text[], $3, now())
     ON CONFLICT (email) DO UPDATE SET
       platforms = EXCLUDED.platforms,
       source = EXCLUDED.source,
       updated_at = now()`,
    [row.email, row.platforms, row.source],
  );
  return "db";
}

function limitOrNull(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  scope: "ip" | "global" | "email",
): Response | null {
  const decision = consumeRateLimit(key, limit, windowMs, now);
  if (!decision.allowed) return rateLimited(decision, scope);
  return null;
}

/**
 * POST /api/waitlist. Browser CORS is applied by middleware from ALLOWED_ORIGINS
 * (marketing origin https://www.splitthewine.app must be on that list in prod).
 */
export async function handleWaitlistRequest(
  req: Request,
  options?: { now?: number; store?: WaitlistStore },
): Promise<Response> {
  const now = options?.now ?? Date.now();
  const limits = waitlistLimits();
  const ip = clientIpFromHeaders(req.headers as HeaderBag);

  const ipBlock = limitOrNull(`waitlist:ip:${ip}`, limits.ipLimit, limits.ipWindowMs, now, "ip");
  if (ipBlock) return ipBlock;
  const globalBlock = limitOrNull("waitlist:global", limits.globalLimit, limits.globalWindowMs, now, "global");
  if (globalBlock) return globalBlock;

  if (!isJsonContentType(req.headers.get("content-type"))) {
    return json({ error: "unsupported_media_type" }, 415);
  }

  const bodyResult = await readLimitedBody(req, WAITLIST_MAX_BYTES);
  if (!bodyResult.ok) return json({ error: bodyResult.error }, 413);

  let raw: unknown;
  try {
    raw = bodyResult.text.trim() ? JSON.parse(bodyResult.text) : null;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parsed = parseWaitlistBody(raw);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  if (parsed.honeypot) {
    // Same success shape as a real write so bots are not told they were dropped,
    // and the marketing page does not fall through to Netlify Forms.
    return json({ ok: true });
  }

  const emailBlock = limitOrNull(
    `waitlist:email:${parsed.email}`,
    limits.emailLimit,
    limits.emailWindowMs,
    now,
    "email",
  );
  if (emailBlock) return emailBlock;

  const store = options?.store ?? defaultStore;
  try {
    const stored = await store({
      email: parsed.email,
      platforms: parsed.platforms,
      source: parsed.source,
    });
    return json({ ok: true, stored });
  } catch (err) {
    const name = err instanceof Error ? err.name : "error";
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : undefined;
    console.error(JSON.stringify({ event: "launch_notify.error", name, code }));
    return json({ error: "unavailable" }, 503);
  }
}
