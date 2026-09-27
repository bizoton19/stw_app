import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretClassifyPayload } from "./vision-stub";

describe("interpretClassifyPayload", () => {
  it("reads a strict JSON object", () => {
    assert.deepEqual(interpretClassifyPayload('{"isReceipt":true}'), { isReceipt: true });
    assert.deepEqual(interpretClassifyPayload('{"isReceipt":false}'), { isReceipt: false });
  });

  it("coerces truthy/falsey values", () => {
    assert.deepEqual(interpretClassifyPayload('{"isReceipt":1}'), { isReceipt: true });
    assert.deepEqual(interpretClassifyPayload('{"isReceipt":0}'), { isReceipt: false });
  });

  it("salvages JSON wrapped in prose", () => {
    assert.deepEqual(
      interpretClassifyPayload('Sure — here you go:\n{"isReceipt": false}\n'),
      { isReceipt: false },
    );
  });

  it("rejects missing isReceipt", () => {
    assert.throws(() => interpretClassifyPayload('{"ok":true}'), /invalid_classify_response/);
  });
});
