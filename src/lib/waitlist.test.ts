import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resetRateLimitForTests } from "./rate-limit";
import { handleWaitlistRequest, normalizeEmail, parseWaitlistBody, type WaitlistRow, type WaitlistStore } from "./waitlist";

const saved: Record<string, string | undefined> = {};

function setLimits(ip = "10", global = "1000", email = "100") {
  for (const [key, value] of Object.entries({
    WAITLIST_IP_LIMIT: ip,
    WAITLIST_IP_WINDOW_SEC: "600",
    WAITLIST_GLOBAL_LIMIT: global,
    WAITLIST_GLOBAL_WINDOW_SEC: "600",
    WAITLIST_EMAIL_LIMIT: email,
    WAITLIST_EMAIL_WINDOW_SEC: "3600",
  })) {
    if (!(key in saved)) saved[key] = process.env[key];
    process.env[key] = value;
  }
}

afterEach(() => {
  resetRateLimitForTests();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function post(body: unknown, ip = "203.0.113.10", extra?: HeadersInit): Request {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json");
  headers.set("x-real-ip", ip);
  return new Request("https://api.splitthewine.app/api/waitlist", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("waitlist validation", () => {
  it("accepts a normal marketing signup and normalizes it", () => {
    const parsed = parseWaitlistBody({
      email: "  Ada@Example.com ",
      platforms: ["IOS", "nope", "android", "ios"],
      source: "Coming-Soon",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.email, "ada@example.com");
    assert.deepEqual(parsed.platforms, ["ios", "android"]);
    assert.equal(parsed.source, "coming-soon");
    assert.equal(parsed.honeypot, false);
  });

  it("rejects addresses that are not deliverable mailboxes", () => {
    for (const email of ["", "not-an-email", "a@b.c", "a@b", "foo@bar..com", ".a@b.com", "a.@b.com", "a@-b.com", "a b@c.com", "user@localhost", `"a"@b.com`]) {
      assert.equal(normalizeEmail(email), null, email);
    }
    assert.equal(normalizeEmail("first.last+tag@sub.example.co.uk"), "first.last+tag@sub.example.co.uk");
    assert.equal(normalizeEmail("a@b.co"), "a@b.co");
  });

  it("rejects a non-object body and a non-array platforms field", () => {
    assert.deepEqual(parseWaitlistBody(null), { ok: false, error: "invalid_body" });
    assert.deepEqual(parseWaitlistBody(["ada@example.com"]), { ok: false, error: "invalid_body" });
    assert.equal(parseWaitlistBody({ email: "ada@example.com", platforms: "ios" }).ok, false);
    const missing = parseWaitlistBody({ platforms: ["ios"] });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error, "invalid_email");
  });

  it("drops hostile source strings back to coming-soon", () => {
    const parsed = parseWaitlistBody({ email: "ada@example.com", source: "<script>" });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.source, "coming-soon");
  });

  it("flags the Netlify honeypot", () => {
    const parsed = parseWaitlistBody({ email: "ada@example.com", "bot-field": "filled" });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.honeypot, true);
  });
});

describe("waitlist handler", { concurrency: 1 }, () => {
  it("upserts a normalized row and returns stored", async () => {
    setLimits();
    let savedRow: WaitlistRow | null = null;
    const store: WaitlistStore = async (row) => {
      savedRow = row;
      return "db";
    };
    const res = await handleWaitlistRequest(
      post({ email: "Ada@Example.com", platforms: ["Android"], source: "partner.launch" }),
      { store },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, stored: "db" });
    assert.deepEqual(savedRow, {
      email: "ada@example.com",
      platforms: ["android"],
      source: "partner.launch",
    });
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  it("does not store honeypot hits", async () => {
    setLimits();
    let calls = 0;
    const res = await handleWaitlistRequest(post({ email: "ada@example.com", company: "acme" }), {
      store: async () => {
        calls += 1;
        return "db";
      },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(calls, 0);
  });

  it("returns stable client errors and does not store them", async () => {
    setLimits();
    let calls = 0;
    const store: WaitlistStore = async () => {
      calls += 1;
      return "db";
    };
    const badEmail = await handleWaitlistRequest(post({ email: "nope" }), { store });
    assert.equal(badEmail.status, 400);
    assert.deepEqual(await badEmail.json(), { error: "invalid_email" });

    const badJson = await handleWaitlistRequest(post("{"), { store });
    assert.equal(badJson.status, 400);
    assert.deepEqual(await badJson.json(), { error: "invalid_json" });

    const badType = await handleWaitlistRequest(
      new Request("https://api.splitthewine.app/api/waitlist", {
        method: "POST",
        headers: { "content-type": "text/plain", "x-real-ip": "203.0.113.11" },
        body: "ada@example.com",
      }),
      { store },
    );
    assert.equal(badType.status, 415);
    assert.deepEqual(await badType.json(), { error: "unsupported_media_type" });

    const huge = await handleWaitlistRequest(
      new Request("https://api.splitthewine.app/api/waitlist", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "8000",
          "x-real-ip": "203.0.113.12",
        },
        body: JSON.stringify({ email: "ada@example.com" }),
      }),
      { store },
    );
    assert.equal(huge.status, 413);
    assert.deepEqual(await huge.json(), { error: "payload_too_large" });
    assert.equal(calls, 0);
  });

  it("rate limits an IP and tells the client when to retry", async () => {
    setLimits("2", "100", "100");
    let calls = 0;
    const store: WaitlistStore = async () => {
      calls += 1;
      return "db";
    };
    const ip = "198.51.100.40";
    const now = 1_700_000_000_000;
    assert.equal((await handleWaitlistRequest(post({ email: "a@b.co" }, ip), { store, now })).status, 200);
    assert.equal((await handleWaitlistRequest(post({ email: "c@d.co" }, ip), { store, now: now + 1 })).status, 200);
    const blocked = await handleWaitlistRequest(post({ email: "e@f.co" }, ip), { store, now: now + 2 });
    assert.equal(blocked.status, 429);
    const body = await blocked.json();
    assert.equal(body.error, "rate_limited");
    assert.ok(body.retryAfter >= 1);
    assert.equal(blocked.headers.get("retry-after"), String(body.retryAfter));
    assert.equal(calls, 2);

    const again = await handleWaitlistRequest(post({ email: "e@f.co" }, ip), { store, now: now + 600_000 });
    assert.equal(again.status, 200);
  });

  it("hides store failures", async () => {
    setLimits();
    const res = await handleWaitlistRequest(post({ email: "ada@example.com" }, "203.0.113.50"), {
      store: async () => {
        throw new Error("password=secret connection refused");
      },
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.deepEqual(body, { error: "unavailable" });
    assert.equal(JSON.stringify(body).includes("secret"), false);
  });
});
