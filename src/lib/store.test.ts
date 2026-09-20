import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addClaim, getPublicReceipt, getTotals, resetStoreForTests } from "./store";

describe("claiming", () => {
  it("rejects overclaiming when concurrent requests race the last units", async () => {
    resetStoreForTests();
    const demo = getPublicReceipt("demo");
    const wine = demo.items.find((item) => item.name.startsWith("BQ Wine"));
    assert.ok(wine);
    const requests = Array.from({ length: 10 }, (_, i) =>
      addClaim("demo", {
        itemId: wine.id,
        personName: `Guest ${i + 1}`,
        units: 1,
      }).then(
        (ok) => ({ ok: true as const, remaining: ok.remaining }),
        (err: unknown) => ({
          ok: false as const,
          code: (err as { code?: string }).code,
        }),
      ),
    );
    const results = await Promise.all(requests);
    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);
    assert.equal(wins.length, 7);
    assert.equal(losses.length, 3);
    assert.ok(losses.every((r) => !r.ok && r.code === "not_enough_remaining"));
    assert.equal(getPublicReceipt("demo").remaining[wine.id], 0);
  });

  it("computes proportional totals after a full claim of the sample tab", async () => {
    resetStoreForTests();
    const demo = getPublicReceipt("demo");
    for (const item of demo.items) {
      await addClaim("demo", {
        itemId: item.id,
        personName: "Alex",
        units: item.qty,
      });
    }
    const totals = getTotals("demo");
    assert.equal(totals.unclaimedItemCents, 0);
    assert.equal(totals.people.length, 1);
    assert.equal(totals.people[0].totalCents, totals.grandTotalCents);
    assert.equal(totals.grandTotalCents, 122315);
  });
});
