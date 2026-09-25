import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatHostPushBody, formatHostPushTitle } from "./host-push";

describe("host push copy", () => {
  it("titles with tab name and today", () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(
      formatHostPushTitle({
        receiptId: "r1",
        kind: "claim",
        personName: "Alex",
        lines: [],
        restaurant: "Bar Marilou",
        receiptDate: today,
      }),
      "Bar Marilou · Today",
    );
  });

  it("formats a single claim with unclaimed + left", () => {
    assert.equal(
      formatHostPushBody({
        receiptId: "r1",
        kind: "claim",
        personName: "Alex",
        lines: [{ name: "Josephine Old Fashioned", units: 2 }],
        unclaimedCents: 4800,
        unitsLeft: 3,
      }),
      "Alex claimed 2× Josephine Old Fashioned · $48.00 still unclaimed · 3 left to claim",
    );
  });

  it("lists a few claimed items", () => {
    assert.equal(
      formatHostPushBody({
        receiptId: "r1",
        kind: "claim",
        personName: "Sam",
        lines: [
          { name: "Wine", units: 1 },
          { name: "Fries", units: 2 },
        ],
        unclaimedCents: 1200,
        unitsLeft: 1,
      }),
      "Sam claimed 1× Wine, 2× Fries · $12.00 still unclaimed · 1 left to claim",
    );
  });

  it("notes when everything is claimed", () => {
    assert.equal(
      formatHostPushBody({
        receiptId: "r1",
        kind: "claim",
        personName: "Alex",
        lines: [{ name: "Latte", units: 1 }],
        unclaimedCents: 0,
        unitsLeft: 0,
      }),
      "Alex claimed 1× Latte · all items claimed",
    );
  });

  it("formats an unclaim with remaining", () => {
    assert.equal(
      formatHostPushBody({
        receiptId: "r1",
        kind: "unclaim",
        personName: "Alex",
        lines: [{ name: "Latte", units: 1 }],
        unclaimedCents: 900,
        unitsLeft: 2,
      }),
      "Alex dropped Latte · $9.00 still unclaimed · 2 left to claim",
    );
  });
});
