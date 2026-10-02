import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientIpFromHeaders, consumeRateLimit, normalizeIp, resetRateLimitForTests } from "./rate-limit";

function headers(init: Record<string, string>): { get(name: string): string | null } {
  const map = new Map(Object.entries(init).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => map.get(name.toLowerCase()) ?? null };
}

describe("rate limit", () => {
  it("blocks inside the window and allows again after it slides", () => {
    resetRateLimitForTests();
    const key = "t:ip";
    assert.equal(consumeRateLimit(key, 2, 10_000, 1_000).allowed, true);
    assert.equal(consumeRateLimit(key, 2, 10_000, 1_500).allowed, true);
    const blocked = consumeRateLimit(key, 2, 10_000, 2_000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.equal(blocked.retryAfterSec, 9);
    const later = consumeRateLimit(key, 2, 10_000, 1_500 + 10_000);
    assert.equal(later.allowed, true);
    assert.equal(later.remaining, 1);
  });
});

describe("client ip", () => {
  it("prefers Cloudflare, then x-real-ip, then the rightmost forwarded hop", () => {
    assert.equal(
      clientIpFromHeaders(
        headers({
          "cf-connecting-ip": "203.0.113.9",
          "x-real-ip": "203.0.113.8",
          "x-forwarded-for": "1.2.3.4, 203.0.113.7",
        }),
      ),
      "203.0.113.9",
    );
    assert.equal(
      clientIpFromHeaders(headers({ "x-real-ip": "203.0.113.8", "x-forwarded-for": "1.2.3.4, 198.51.100.20" })),
      "203.0.113.8",
    );
    assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.20" })), "198.51.100.20");
    assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "not-an-ip" })), "unknown");
    assert.equal(clientIpFromHeaders(headers({})), "unknown");
  });

  it("rejects spoofed junk and leading-zero IPv4", () => {
    assert.equal(normalizeIp("01.2.3.4"), null);
    assert.equal(normalizeIp("203.0.113.5:443"), "203.0.113.5");
    assert.equal(normalizeIp("::1"), "::1");
    assert.equal(normalizeIp("nope"), null);
  });
});
