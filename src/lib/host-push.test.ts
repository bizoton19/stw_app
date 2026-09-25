import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatHostPushBody } from "./host-push";

describe("formatHostPushBody", () => {
  it("formats a single claim line", () => {
    assert.equal(
      formatHostPushBody({
        receiptId: "r1",
        kind: "claim",
        personName: "Alex",
        lines: [{ name: "Josephine Old Fashioned", units: 2 }],
      }),
      "Alex claimed 2× Josephine Old Fashioned",
    );
  });

  it("formats a multi-item claim", () => {
    assert.equal(
      formatHostPushBody({
        receiptId: "r1",
        kind: "claim",
        personName: "Sam",
        lines: [
          { name: "Wine", units: 1 },
          { name: "Fries", units: 2 },
        ],
      }),
      "Sam claimed 3 items on tonight’s tab",
    );
  });

  it("formats an unclaim", () => {
    assert.equal(
      formatHostPushBody({
        receiptId: "r1",
        kind: "unclaim",
        personName: "Alex",
        lines: [{ name: "Latte", units: 1 }],
      }),
      "Alex dropped Latte",
    );
  });
});
