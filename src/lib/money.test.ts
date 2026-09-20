import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centsToLabel, dollarsToCents, sumCents, unitCentsArray } from "./money";
import {
  SAMPLE_FEE_TOTAL_CENTS,
  SAMPLE_GRAND_TOTAL_CENTS,
  SAMPLE_ITEM_SUBTOTAL_CENTS,
  SAMPLE_PARSE,
} from "./sample-tab";
import { allocateProportional, computeTotals } from "./totals";
import type { Receipt } from "./types";

describe("money", () => {
  it("converts dollars without float drift", () => {
    assert.equal(dollarsToCents(78.8), 7880);
    assert.equal(dollarsToCents(44.79), 4479);
    assert.equal(centsToLabel(122315), "$1,223.15");
  });

  it("splits line totals across units with no leftover cents", () => {
    const units = unitCentsArray(12000, 8);
    assert.equal(units.length, 8);
    assert.equal(sumCents(units), 12000);
    assert.deepEqual(units, [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500]);
  });
});

describe("sample tab fixture", () => {
  it("matches the plan's published totals", () => {
    const items = SAMPLE_PARSE.items.reduce((s, i) => s + dollarsToCents(i.total), 0);
    const fees = SAMPLE_PARSE.fees.reduce((s, f) => s + dollarsToCents(f.amount), 0);
    assert.equal(items, SAMPLE_ITEM_SUBTOTAL_CENTS);
    assert.equal(fees, SAMPLE_FEE_TOTAL_CENTS);
    assert.equal(items + fees, SAMPLE_GRAND_TOTAL_CENTS);
  });
});

describe("fee split", () => {
  it("allocates fees by claimed subtotal, not headcount", () => {
    const receipt: Receipt = {
      id: "t",
      status: "open",
      restaurant: "The Bar",
      createdAt: "",
      items: [
        { id: "wine", name: "BQ Wine Package ($60)", qty: 7, totalCents: 42000 },
        { id: "juice", name: "Apple Juice", qty: 1, totalCents: 400 },
      ],
      fees: [{ id: "tax", name: "Tax", amountCents: 10000 }],
      claims: [
        {
          id: "c1",
          itemId: "wine",
          personName: "Alex",
          units: 7,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c2",
          itemId: "juice",
          personName: "Sam",
          units: 1,
          createdAt: "2026-01-01T00:00:01.000Z",
        },
      ],
    };
    const totals = computeTotals(receipt);
    const alex = totals.people.find((p) => p.personName === "Alex");
    const sam = totals.people.find((p) => p.personName === "Sam");
    assert.ok(alex && sam);
    assert.equal(alex.itemCents, 42000);
    assert.equal(sam.itemCents, 400);
    assert.equal(alex.feeCents + sam.feeCents, 10000);
    assert.ok(alex.feeCents > sam.feeCents);
    assert.equal(alex.totalCents + sam.totalCents, 52400);
  });

  it("does not dump all fees on the first person while the check is still open", () => {
    const receipt: Receipt = {
      id: "t2",
      status: "open",
      restaurant: "The Bar",
      createdAt: "",
      items: [
        { id: "wine", name: "BQ Wine Package ($60)", qty: 7, totalCents: 42000 },
        { id: "juice", name: "Apple Juice", qty: 1, totalCents: 400 },
      ],
      fees: [{ id: "tax", name: "Tax", amountCents: 10000 }],
      claims: [
        {
          id: "c2",
          itemId: "juice",
          personName: "Sam",
          units: 1,
          createdAt: "2026-01-01T00:00:01.000Z",
        },
      ],
    };
    const totals = computeTotals(receipt);
    const sam = totals.people.find((p) => p.personName === "Sam");
    assert.ok(sam);
    assert.equal(sam.itemCents, 400);
    assert.ok(sam.feeCents < 1000);
    assert.equal(sam.feeCents + Math.round((10000 * 42000) / 42400), 10000);
  });

  it("keeps proportional remainders exact", () => {
    assert.deepEqual(allocateProportional(100, [1, 1, 1]), [34, 33, 33]);
    assert.equal(sumCents(allocateProportional(32735, [42400, 47180])), 32735);
  });
});
