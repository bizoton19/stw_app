import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { revealScrollDelta } from "./reveal-in-scroll.ts";

describe("revealScrollDelta", () => {
  const viewport = { y: 180, height: 240 };

  it("leaves a row that already sits in the list", () => {
    assert.equal(revealScrollDelta({ y: 200, height: 72 }, viewport), 0);
  });

  it("scrolls a row that the sticky footer would cover", () => {
    // Row bottom is 40px past the viewport's bottom edge, plus the 8px margin.
    const row = { y: 380, height: 72 };
    assert.equal(revealScrollDelta(row, viewport), 40);
  });

  it("decreases offset when the row sits above the viewport", () => {
    assert.equal(revealScrollDelta({ y: 100, height: 72 }, viewport), -88);
  });

  it("pins a row taller than the remaining area to the top", () => {
    const row = { y: 400, height: 300 };
    assert.equal(revealScrollDelta(row, viewport), 400 - (180 + 8));
  });

  it("does nothing for an empty viewport", () => {
    assert.equal(revealScrollDelta({ y: 10, height: 20 }, { y: 0, height: 0 }), 0);
  });
});
