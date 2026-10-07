import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rescaleLineTotal } from "./host-line-qty.ts";

describe("rescaleLineTotal", () => {
  it("keeps the unit price when quantity steps up", () => {
    assert.deepEqual(rescaleLineTotal(1000, 2, 3), {
      qty: 3,
      totalCents: 1500,
      totalInput: "15.00",
    });
  });

  it("steps down without dropping the unit price", () => {
    assert.deepEqual(rescaleLineTotal(1700, 2, 1), {
      qty: 1,
      totalCents: 850,
      totalInput: "8.50",
    });
  });

  it("rounds the unit the same way the old keystroke handler did", () => {
    assert.deepEqual(rescaleLineTotal(1001, 2, 3), {
      qty: 3,
      totalCents: 1503,
      totalInput: "15.03",
    });
  });

  it("treats a zero previous quantity as one unit", () => {
    assert.deepEqual(rescaleLineTotal(500, 0, 2), {
      qty: 2,
      totalCents: 1000,
      totalInput: "10.00",
    });
  });
});
