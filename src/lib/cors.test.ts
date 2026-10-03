import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accessControlAllowOrigin, corsHeadersFor, parseAllowedOrigins } from "./cors";

const PROD = "https://api.splitthewine.app,https://www.splitthewine.app";

describe("cors", () => {
  it("parses ALLOWED_ORIGINS the same way as .env.example", () => {
    assert.deepEqual(parseAllowedOrigins(PROD), [
      "https://api.splitthewine.app",
      "https://www.splitthewine.app",
    ]);
    assert.equal(parseAllowedOrigins("  "), null);
    assert.equal(parseAllowedOrigins(undefined), null);
  });

  it("allows the marketing origin and does not reflect a stranger", () => {
    const allowlist = parseAllowedOrigins(PROD);
    const headers = corsHeadersFor("https://www.splitthewine.app", allowlist);
    assert.equal(headers["Access-Control-Allow-Origin"], "https://www.splitthewine.app");
    assert.equal(headers.Vary, "Origin");
    assert.match(headers["Access-Control-Allow-Headers"], /Content-Type/);
    assert.match(headers["Access-Control-Allow-Headers"], /X-Host-Token/);
    assert.match(headers["Access-Control-Allow-Methods"], /POST/);

    const denied = corsHeadersFor("https://evil.example", allowlist);
    assert.equal(denied["Access-Control-Allow-Origin"], undefined);
    assert.equal(accessControlAllowOrigin("https://evil.example", allowlist), null);
    assert.equal(accessControlAllowOrigin(null, allowlist), null);
  });

  it("reflects any origin only when the allowlist is unset", () => {
    assert.equal(
      corsHeadersFor("http://localhost:8888", null)["Access-Control-Allow-Origin"],
      "http://localhost:8888",
    );
    assert.equal(corsHeadersFor(null, null)["Access-Control-Allow-Origin"], "*");
  });
});
