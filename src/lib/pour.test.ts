import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claimCapacity, pourAsGlasses, suggestPourForItem } from "./pour";
import { computeTotals, remainingForItem } from "./totals";
import type { Receipt } from "./types";

describe("pour heuristics", () => {
  it("suggests 6 glasses for a wine package", () => {
    const s = suggestPourForItem({
      id: "it_1",
      name: "BQ Wine Package",
      qty: 1,
      totalCents: 42000,
      kind: "drink",
    });
    assert.ok(s);
    assert.equal(s!.suggestGlasses, 6);
  });

  it("suggests 12 for magnum", () => {
    const s = suggestPourForItem({
      id: "it_1",
      name: "Magnum Cabernet",
      qty: 1,
      totalCents: 18000,
      kind: "drink",
    });
    assert.ok(s);
    assert.equal(s!.suggestGlasses, 12);
  });

  it("skips food packages", () => {
    assert.equal(
      suggestPourForItem({
        id: "it_1",
        name: "Family Package",
        qty: 1,
        totalCents: 8000,
        kind: "food",
      }),
      null,
    );
  });

  it("skips already-glass lines with high qty", () => {
    assert.equal(
      suggestPourForItem({
        id: "it_1",
        name: "Glass of Pinot",
        qty: 4,
        totalCents: 6400,
        kind: "drink",
      }),
      null,
    );
  });

  it("skips a single glass of champagne", () => {
    assert.equal(
      suggestPourForItem({
        id: "it_1",
        name: "Glass of Champagne",
        qty: 1,
        totalCents: 1800,
        kind: "drink",
      }),
      null,
    );
    assert.equal(
      suggestPourForItem({
        id: "it_1",
        name: "GL Champagne",
        qty: 1,
        totalCents: 1800,
        kind: "drink",
      }),
      null,
    );
  });

  it("still suggests for bottle champagne", () => {
    const s = suggestPourForItem({
      id: "it_1",
      name: "Btl Champagne",
      qty: 1,
      totalCents: 9000,
      kind: "drink",
    });
    assert.ok(s);
    assert.equal(s!.suggestGlasses, 6);
  });
});

describe("glass claim money", () => {
  it("splits one bottle into 6 glasses across two claimers with exact fees", () => {
    const bottle = {
      id: "it_wine",
      name: "BQ Wine Package",
      qty: 1,
      totalCents: 42000,
      kind: "drink" as const,
      pour: pourAsGlasses(6),
    };
    assert.equal(claimCapacity(bottle), 6);

    const receipt: Receipt = {
      id: "r1",
      status: "open",
      restaurant: "Test",
      items: [bottle],
      fees: [{ id: "fe_1", name: "Tax", amountCents: 4200 }],
      claims: [
        {
          id: "c1",
          itemId: "it_wine",
          personName: "Alex",
          units: 3,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c2",
          itemId: "it_wine",
          personName: "Sam",
          units: 3,
          createdAt: "2026-01-01T00:00:01.000Z",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    assert.equal(remainingForItem(bottle, receipt.claims), 0);
    const totals = computeTotals(receipt);
    assert.equal(totals.claimedItemCents, 42000);
    assert.equal(totals.unclaimedItemCents, 0);
    assert.equal(totals.feeTotalCents, 4200);
    const alex = totals.people.find((p) => p.personName === "Alex")!;
    const sam = totals.people.find((p) => p.personName === "Sam")!;
    assert.equal(alex.itemCents, 21000);
    assert.equal(sam.itemCents, 21000);
    assert.equal(alex.feeCents + sam.feeCents, 4200);
    assert.equal(alex.lines[0]?.itemName, "BQ Wine Package (glass)");
    assert.equal(alex.lines[0]?.units, 3);
  });

  it("keeps printed capacity when mode is as_printed", () => {
    const item = {
      id: "it_1",
      name: "Bottle",
      qty: 2,
      totalCents: 12000,
      pour: { mode: "as_printed" as const, glassesPerPrintedUnit: 1 },
    };
    assert.equal(claimCapacity(item), 2);
  });
});
