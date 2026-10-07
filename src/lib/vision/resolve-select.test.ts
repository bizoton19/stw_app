import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseVisionProviderId, selectVisionProviderId } from "./resolve-select";

describe("parseVisionProviderId", () => {
  it("accepts known ids", () => {
    assert.equal(parseVisionProviderId("gemini"), "gemini");
    assert.equal(parseVisionProviderId("OpenRouter"), "openrouter");
  });

  it("rejects unknown ids", () => {
    assert.equal(parseVisionProviderId("openai"), null);
    assert.equal(parseVisionProviderId(""), null);
    assert.equal(parseVisionProviderId(undefined), null);
  });
});

describe("selectVisionProviderId", () => {
  it("prefers explicit VISION_PROVIDER when configured", () => {
    assert.equal(
      selectVisionProviderId(
        { VISION_PROVIDER: "openrouter" } as NodeJS.ProcessEnv,
        { gemini: true, openrouter: true },
      ),
      "openrouter",
    );
  });

  it("returns null when forced provider is not configured", () => {
    assert.equal(
      selectVisionProviderId(
        { VISION_PROVIDER: "gemini" } as NodeJS.ProcessEnv,
        { gemini: false, openrouter: true },
      ),
      null,
    );
  });

  it("auto-picks gemini before openrouter", () => {
    assert.equal(
      selectVisionProviderId({} as NodeJS.ProcessEnv, { gemini: true, openrouter: true }),
      "gemini",
    );
  });

  it("falls back to openrouter", () => {
    assert.equal(
      selectVisionProviderId({} as NodeJS.ProcessEnv, { gemini: false, openrouter: true }),
      "openrouter",
    );
  });

  it("returns null with nothing configured", () => {
    assert.equal(selectVisionProviderId({} as NodeJS.ProcessEnv, {}), null);
  });
});
