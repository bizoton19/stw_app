import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centsToLabel, dollarsToCents, remainingLineCents, unitPriceCents } from "./money";
import {
  SAMPLE_FEE_TOTAL_CENTS,
  SAMPLE_GRAND_TOTAL_CENTS,
  SAMPLE_ITEM_SUBTOTAL_CENTS,
  SAMPLE_PARSE,
  SAMPLE_RESTAURANT,
} from "./sample-tab";
import { computeTotals, remainingForItem, shareSoFarCents } from "./totals";
import type { Fee, Item, Receipt } from "./types";

/**
 * Screen money contract — pure `computeTotals` + `centsToLabel`.
 *
 * Host share, fees footer, claim rows, and settle all render these helpers.
 * Locking the strings here catches math/display drift without spinning up
 * Expo/Detox. Full UI E2E (Maestro) can come later for navigation chrome.
 */

function receiptFromSample(claims: Receipt["claims"] = []): Receipt {
  const items: Item[] = SAMPLE_PARSE.items.map((row, i) => ({
    id: `it_${i}`,
    name: row.name,
    qty: row.qty,
    totalCents: dollarsToCents(row.total),
    kind: row.kind ?? null,
  }));
  const fees: Fee[] = SAMPLE_PARSE.fees.map((row, i) => ({
    id: `fee_${i}`,
    name: row.name,
    amountCents: dollarsToCents(row.amount),
  }));
  return {
    id: "contract",
    status: "open",
    restaurant: SAMPLE_RESTAURANT,
    createdAt: "2025-09-20T00:00:00.000Z",
    items,
    fees,
    claims,
  };
}

describe("screen money contract — sample tab labels", () => {
  it("host share / fees footer show published grand total", () => {
    const receipt = receiptFromSample();
    const totals = computeTotals(receipt);

    assert.equal(totals.itemSubtotalCents, SAMPLE_ITEM_SUBTOTAL_CENTS);
    assert.equal(totals.feeTotalCents, SAMPLE_FEE_TOTAL_CENTS);
    assert.equal(totals.grandTotalCents, SAMPLE_GRAND_TOTAL_CENTS);

    // Host share.tsx + fees.tsx + settle “Grand Total”
    assert.equal(centsToLabel(totals.itemSubtotalCents), "$895.80");
    assert.equal(centsToLabel(totals.feeTotalCents), "$327.35");
    assert.equal(centsToLabel(totals.grandTotalCents), "$1,223.15");
  });

  it("claim row labels stay penny-fair for a multi-unit line", () => {
    const receipt = receiptFromSample();
    const wine = receipt.items.find((i) => i.name.startsWith("BQ Wine"));
    assert.ok(wine);
    // 42000¢ / 7 = $60.00 each
    assert.equal(unitPriceCents(wine.totalCents, wine.qty), 6000);
    assert.equal(centsToLabel(unitPriceCents(wine.totalCents, wine.qty)), "$60.00");
    assert.equal(remainingForItem(wine, receipt.claims), 7);
    assert.equal(remainingLineCents(wine.totalCents, wine.qty, 7), 42000);
    assert.equal(centsToLabel(remainingLineCents(wine.totalCents, wine.qty, 7)), "$420.00");
  });

  it("settle ‘you owe’ matches proportional fees after a partial claim", () => {
    const receipt = receiptFromSample();
    const juice = receipt.items.find((i) => i.name === "Apple Juice");
    const botanist = receipt.items.find((i) => i.name === "The Botanist");
    assert.ok(juice && botanist);

    receipt.claims = [
      {
        id: "c1",
        itemId: juice.id,
        personName: "Maya",
        units: 1,
        createdAt: "2025-09-20T01:00:00.000Z",
      },
      {
        id: "c2",
        itemId: botanist.id,
        personName: "Maya",
        units: 1,
        createdAt: "2025-09-20T01:00:01.000Z",
      },
    ];

    const totals = computeTotals(receipt);
    const maya = totals.people.find((p) => p.personName === "Maya");
    assert.ok(maya);

    // Items: $4 + $18 = $22
    assert.equal(maya.itemCents, 2200);
    assert.equal(centsToLabel(maya.itemCents), "$22.00");

    // Fee share is proportional to claimed items vs tab + unclaimed weight.
    assert.equal(maya.totalCents, maya.itemCents + maya.feeCents);
    assert.ok(maya.feeCents > 0);
    assert.ok(maya.feeCents < totals.feeTotalCents);
    assert.ok(maya.totalCents < totals.grandTotalCents);

    // Settle “You” + “still on the table”
    assert.equal(centsToLabel(maya.totalCents), centsToLabel(maya.itemCents + maya.feeCents));
    assert.equal(totals.unclaimedItemCents, SAMPLE_ITEM_SUBTOTAL_CENTS - 2200);
    assert.equal(centsToLabel(totals.unclaimedItemCents), "$873.80");

    // Claim board quiet line — same total, tax & tip included, not a fee table.
    assert.equal(shareSoFarCents(receipt, "Maya"), maya.totalCents);
    assert.ok(maya.totalCents > maya.itemCents);
    assert.equal(
      `Your share so far · ${centsToLabel(shareSoFarCents(receipt, "Maya"))} (incl. tax & tip)`,
      `Your share so far · ${centsToLabel(maya.totalCents)} (incl. tax & tip)`,
    );
    assert.equal(shareSoFarCents(receipt, "Nobody"), 0);
    assert.equal(shareSoFarCents(receipt, "  "), 0);

    const wine = receipt.items.find((i) => i.name.startsWith("BQ Wine"));
    assert.ok(wine);
    const withQueue = shareSoFarCents(receipt, "Maya", [{ itemId: wine.id, units: 1 }]);
    assert.ok(withQueue > maya.totalCents);
    const projected = computeTotals({
      ...receipt,
      claims: [
        ...receipt.claims,
        {
          id: "preview",
          itemId: wine.id,
          personName: "Maya",
          units: 1,
          createdAt: "2025-09-20T01:00:02.000Z",
        },
      ],
    }).people.find((p) => p.personName === "Maya");
    assert.equal(withQueue, projected?.totalCents);
  });

  it("fully claimed sample tab: one person owes the whole grand total", () => {
    const receipt = receiptFromSample();
    receipt.claims = receipt.items.map((item, i) => ({
      id: `full_${i}`,
      itemId: item.id,
      personName: "Alex",
      units: item.qty,
      createdAt: `2025-09-20T02:00:${String(i).padStart(2, "0")}.000Z`,
    }));

    const totals = computeTotals(receipt);
    assert.equal(totals.unclaimedItemCents, 0);
    assert.equal(totals.people.length, 1);
    assert.equal(totals.people[0]!.totalCents, SAMPLE_GRAND_TOTAL_CENTS);
    assert.equal(centsToLabel(totals.people[0]!.totalCents), "$1,223.15");
  });
});
