import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addClaim,
  addClaims,
  deleteReceipt,
  finalizeReceipt,
  getPublicReceipt,
  getTotals,
  resetStoreForTests,
} from "./store";

describe("claiming", () => {
  it("rejects overclaiming when concurrent requests race the last units", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
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
    assert.equal((await getPublicReceipt("demo")).remaining[wine.id], 0);
  });

  it("names the winner when a late claim races a fully taken line", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    assert.ok(juice);
    await addClaim("demo", {
      itemId: juice.id,
      personName: "Sam",
      units: juice.qty,
    });
    await assert.rejects(
      () =>
        addClaim("demo", {
          itemId: juice.id,
          personName: "Alex",
          units: 1,
        }),
      (err: unknown) => {
        const e = err as { code?: string; claimedBy?: string; message?: string; remaining?: number };
        assert.equal(e.code, "not_enough_remaining");
        assert.equal(e.remaining, 0);
        assert.equal(e.claimedBy, "Sam");
        assert.match(String(e.message), /already been claimed by Sam/);
        return true;
      },
    );
  });

  it("computes proportional totals after a full claim of the sample tab", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    for (const item of demo.items) {
      await addClaim("demo", {
        itemId: item.id,
        personName: "Alex",
        units: item.qty,
      });
    }
    const totals = await getTotals("demo");
    assert.equal(totals.unclaimedItemCents, 0);
    assert.equal(totals.people.length, 1);
    assert.equal(totals.people[0].totalCents, totals.grandTotalCents);
    assert.equal(totals.grandTotalCents, 122315);
  });

  it("claims several lines together and leaves remaining unchanged if the batch would overclaim", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    const botanist = demo.items.find((item) => item.name === "The Botanist");
    assert.ok(juice);
    assert.ok(botanist);
    const result = await addClaims("demo", {
      personName: "Maya",
      personContact: "@maya",
      claims: [
        { itemId: juice.id, units: 1 },
        { itemId: botanist.id, units: 1 },
      ],
    });
    assert.equal(result.claims.length, 2);
    assert.equal((await getPublicReceipt("demo")).remaining[juice.id], 0);
    assert.equal((await getPublicReceipt("demo")).remaining[botanist.id], 0);

    resetStoreForTests();
    const wine = (await getPublicReceipt("demo")).items.find((item) => item.name.startsWith("BQ Wine"));
    assert.ok(wine);
    await assert.rejects(
      () =>
        addClaims("demo", {
          personName: "Maya",
          claims: [
            { itemId: wine.id, units: 7 },
            { itemId: wine.id, units: 1 },
          ],
        }),
      (err: unknown) => (err as { code?: string }).code === "not_enough_remaining",
    );
    assert.equal((await getPublicReceipt("demo")).remaining[wine.id], 7);
  });
});

describe("delete closed tab", () => {
  it("rejects delete while the tab is still open", async () => {
    resetStoreForTests();
    await assert.rejects(
      () => deleteReceipt("demo", "demo-host"),
      (err: unknown) => (err as { code?: string }).code === "conflict",
    );
  });

  it("deletes a finalized tab for the host", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    for (const item of demo.items) {
      await addClaim("demo", {
        itemId: item.id,
        personName: "Alex",
        units: item.qty,
      });
    }
    await finalizeReceipt("demo", "demo-host");
    assert.equal((await getPublicReceipt("demo")).status, "finalized");
    await deleteReceipt("demo", "demo-host");
    await assert.rejects(
      () => getPublicReceipt("demo"),
      (err: unknown) => (err as { code?: string }).code === "not_found",
    );
  });
});
