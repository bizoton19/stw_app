import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centsToLabel, dollarsToCents, remainingLineCents, sumCents, unitCentsArray, unitPriceCents } from "./money";
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

  it("prices remaining as unit × left (penny-fair slice)", () => {
    assert.equal(unitPriceCents(1001, 3), 333);
    assert.equal(remainingLineCents(1001, 3, 3), 1001);
    assert.equal(remainingLineCents(1001, 3, 2), 667);
    assert.equal(remainingLineCents(1001, 3, 1), 333);
    assert.equal(remainingLineCents(1001, 3, 0), 0);
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

  it("does not merge two guests who share a display name", () => {
    const alexA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const alexB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const receipt: Receipt = {
      id: "dup",
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
          guestId: alexA,
          personName: "Alex",
          units: 7,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c2",
          itemId: "juice",
          guestId: alexB,
          personName: "Alex",
          units: 1,
          createdAt: "2026-01-01T00:00:01.000Z",
        },
      ],
    };
    const totals = computeTotals(receipt);
    const people = totals.people.filter((p) => p.personName === "Alex");
    assert.equal(people.length, 2);
    const a = people.find((p) => p.guestId === alexA);
    const b = people.find((p) => p.guestId === alexB);
    assert.ok(a && b);
    assert.equal(a.itemCents, 42000);
    assert.equal(b.itemCents, 400);
    assert.equal(a.feeCents + b.feeCents, 10000);
  });

  it("keeps one person when the same guestId claims under a new display name", () => {
    const guestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const receipt: Receipt = {
      id: "rename",
      status: "open",
      restaurant: "The Bar",
      createdAt: "",
      items: [
        { id: "wine", name: "BQ Wine Package ($60)", qty: 7, totalCents: 42000 },
        { id: "juice", name: "Apple Juice", qty: 1, totalCents: 400 },
      ],
      fees: [],
      claims: [
        {
          id: "c1",
          itemId: "wine",
          guestId,
          personName: "Alex",
          units: 7,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c2",
          itemId: "juice",
          guestId,
          personName: "Alex R.",
          units: 1,
          createdAt: "2026-01-01T00:00:02.000Z",
        },
      ],
    };
    const totals = computeTotals(receipt);
    assert.equal(totals.people.length, 1);
    assert.equal(totals.people[0]?.guestId, guestId);
    assert.equal(totals.people[0]?.personName, "Alex R.");
    assert.equal(totals.people[0]?.itemCents, 42400);
  });

  it("does not fold a legacy name-only claim into a guestId row with the same name", () => {
    const guestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const receipt: Receipt = {
      id: "legacy",
      status: "open",
      restaurant: "The Bar",
      createdAt: "",
      items: [
        { id: "wine", name: "BQ Wine Package ($60)", qty: 7, totalCents: 42000 },
        { id: "juice", name: "Apple Juice", qty: 1, totalCents: 400 },
      ],
      fees: [],
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
          guestId,
          personName: "Alex",
          units: 1,
          createdAt: "2026-01-01T00:00:01.000Z",
        },
      ],
    };
    const totals = computeTotals(receipt);
    assert.equal(totals.people.length, 2);
    assert.equal(totals.people.filter((p) => p.personName === "Alex").length, 2);
    assert.equal(totals.people.find((p) => p.guestId === guestId)?.itemCents, 400);
    assert.equal(totals.people.find((p) => !p.guestId)?.itemCents, 42000);
  });

  it("keeps proportional remainders exact", () => {
    assert.deepEqual(allocateProportional(100, [1, 1, 1]), [34, 33, 33]);
    assert.equal(sumCents(allocateProportional(32735, [42400, 47180])), 32735);
  });
});
