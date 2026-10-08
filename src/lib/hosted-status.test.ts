import assert from "node:assert/strict";
import { test } from "node:test";
import { hostedStatusTone } from "../../apps/mobile/src/lib/hosted-status";

test("draft and planning share the merlot tone, not Open", () => {
  assert.equal(hostedStatusTone("draft"), "draft");
  assert.equal(hostedStatusTone("planning"), "draft");
  assert.notEqual(hostedStatusTone("draft"), "open");
  assert.notEqual(hostedStatusTone("planning"), "open");
});

test("closed is its own tone and everything else is open", () => {
  assert.equal(hostedStatusTone("finalized"), "closed");
  assert.equal(hostedStatusTone("open"), "open");
  assert.equal(hostedStatusTone(undefined), "open");
  assert.equal(hostedStatusTone(null), "open");
  assert.equal(hostedStatusTone(""), "open");
});
