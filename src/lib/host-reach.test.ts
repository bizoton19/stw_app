import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directionsUrl, hostReachUrl, normalizeHostReach } from "./host-reach";

describe("host-reach", () => {
  it("normalizes reach", () => {
    assert.deepEqual(normalizeHostReach({ channel: "whatsapp", value: " 555 " }), {
      channel: "whatsapp",
      value: "555",
    });
    assert.equal(normalizeHostReach({ channel: "nope", value: "x" }), undefined);
  });

  it("builds whatsapp and directions urls", () => {
    assert.equal(hostReachUrl({ channel: "whatsapp", value: "+1 555 123 4567" }), "https://wa.me/15551234567");
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
