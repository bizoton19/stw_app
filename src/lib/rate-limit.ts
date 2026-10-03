/**
 * In-process sliding window. One Railway replica shares this map;
 * extra replicas multiply the budget. Not a substitute for edge limits.
 */

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
};

const buckets = new Map<string, number[]>();

export function resetRateLimitForTests(): void {
  buckets.clear();
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitDecision {
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    const oldest = recent[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec, remaining: 0 };
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 4000) prune(cutoff);
  return { allowed: true, retryAfterSec: 0, remaining: limit - recent.length };
}

function prune(cutoff: number) {
  for (const [key, stamps] of buckets) {
    const recent = stamps.filter((t) => t > cutoff);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isIpv4(value: string): boolean {
  if (!IPV4.test(value)) return false;
  return value.split(".").every((part) => {
    const n = Number(part);
    return n <= 255 && String(n) === part;
  });
}

/** Loose IPv6 check (including IPv4-mapped). Rejects empty and garbage labels. */
function isIpv6(value: string): boolean {
  if (!value.includes(":") || value.length > 64) return false;
  if (!/^[0-9a-f:.]+$/i.test(value)) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const groups = value.split(":").filter((g) => g.length > 0);
  return groups.every((g) => g.includes(".") || /^[0-9a-f]{1,4}$/i.test(g));
}

export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value || value.length > 64) return null;
  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  }
  if (isIpv4(value)) return value;
  const v4Port = value.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (v4Port && isIpv4(v4Port[1])) return v4Port[1];
  if (isIpv6(value)) return value.toLowerCase();
  return null;
}

/**
 * Client address for rate limits.
 * Prefer Cloudflare's client header, then Railway's `x-real-ip`.
 * `x-forwarded-for` uses the rightmost valid address — the hop the
 * nearest proxy appended. Leftmost values are client-supplied.
 */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const cf = normalizeIp(headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const real = normalizeIp(headers.get("x-real-ip"));
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const ip = normalizeIp(parts[i]);
      if (ip) return ip;
    }
  }
  return "unknown";
}
