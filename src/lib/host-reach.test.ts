import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directionsUrl, hostReachUrl, normalizeHostReach, validateHostReach } from "./host-reach";
import { validatePhoneParts } from "./phone";

describe("host-reach", () => {
  it("normalizes E.164 phones and rejects junk", () => {
    assert.deepEqual(normalizeHostReach({ channel: "whatsapp", value: "+15551234567" }), {
      channel: "whatsapp",
      value: "+15551234567",
    });
    assert.equal(normalizeHostReach({ channel: "sms", value: "not-a-phone" }), undefined);
    assert.equal(normalizeHostReach({ channel: "nope", value: "x" }), undefined);
  });

  it("validates email reach", () => {
    const ok = validateHostReach("email", "host@example.com");
    assert.equal(ok.ok, true);
    const bad = validateHostReach("email", "nope");
    assert.equal(bad.ok, false);
  });

  it("builds whatsapp and directions urls", () => {
    assert.equal(
      hostReachUrl({ channel: "whatsapp", value: "+15551234567" }),
      "https://wa.me/15551234567",
    );
    assert.match(
      directionsUrl({ lat: 40.7, lng: -74.0, name: "Bar" }, "ios")!,
      /maps\.apple\.com/,
    );
    assert.match(
      directionsUrl({ lat: 40.7, lng: -74.0, name: "Bar" }, "android")!,
      /google\.com\/maps/,
    );
  });
});

describe("phone", () => {
  it("validates US and Haiti national numbers", () => {
    assert.deepEqual(validatePhoneParts("1", "5551234567"), {
      ok: true,
      e164: "+15551234567",
    });
    assert.equal(validatePhoneParts("1", "555").ok, false);
    assert.deepEqual(validatePhoneParts("509", "38123456"), {
      ok: true,
      e164: "+50938123456",
    });
  });
});
