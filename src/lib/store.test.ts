import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addClaim,
  addClaims,
  getPublicReceipt,
  getTotals,
  removeClaim,
  resetStoreForTests,
  updateGuestDisplay,
} from "./store";

const ALEX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALEX_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

  it("keeps two guests with the same display name separate and token-safe", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    const botanist = demo.items.find((item) => item.name === "The Botanist");
    assert.ok(juice);
    assert.ok(botanist);
    const first = await addClaim("demo", {
      itemId: juice.id,
      guestId: ALEX_A,
      personName: "Alex",
      units: 1,
    });
    const second = await addClaim("demo", {
      itemId: botanist.id,
      guestId: ALEX_B,
      personName: "Alex",
      personContact: "@b",
      units: 1,
    });
    assert.equal(first.claim.guestId, ALEX_A);
    assert.equal(second.claim.guestId, ALEX_B);
    assert.notEqual(first.ownerToken, second.ownerToken);

    const totals = await getTotals("demo");
    const alexes = totals.people.filter((person) => person.guestId === ALEX_A || person.guestId === ALEX_B);
    assert.equal(alexes.length, 2);
    assert.ok(alexes.every((person) => person.personName === "Alex"));
    const mine = totals.people.find((person) => person.guestId === ALEX_A);
    const other = totals.people.find((person) => person.guestId === ALEX_B);
    assert.ok(mine && other);
    assert.notEqual(mine.totalCents, other.totalCents);

    await assert.rejects(
      () => removeClaim(first.claim.id, second.ownerToken, null),
      (err: unknown) => (err as { code?: string }).code === "forbidden",
    );
    await removeClaim(first.claim.id, first.ownerToken, null);
    const after = await getPublicReceipt("demo");
    assert.equal(after.claims.some((claim) => claim.id === first.claim.id), false);
    assert.equal(after.claims.some((claim) => claim.guestId === ALEX_B), true);
  });

  it("relabels one guestId without merging the other person who shares the name", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    const botanist = demo.items.find((item) => item.name === "The Botanist");
    assert.ok(juice);
    assert.ok(botanist);
    await addClaim("demo", {
      itemId: juice.id,
      guestId: ALEX_A,
      personName: "Alex",
      units: 1,
    });
    await addClaims("demo", {
      guestId: ALEX_A,
      personName: "Alexis",
      personContact: "@a",
      claims: [{ itemId: botanist.id, units: 1 }],
    });
    const totals = await getTotals("demo");
    assert.equal(totals.people.filter((person) => person.guestId === ALEX_A).length, 1);
    assert.equal(totals.people.find((person) => person.guestId === ALEX_A)?.personName, "Alexis");
    const receipt = await getPublicReceipt("demo");
    assert.ok(receipt.claims.filter((claim) => claim.guestId === ALEX_A).every((claim) => claim.personName === "Alexis"));

    const wine = demo.items.find((item) => item.name.startsWith("BQ Wine"));
    assert.ok(wine);
    await addClaim("demo", {
      itemId: wine.id,
      guestId: ALEX_B,
      personName: "Alex",
      units: 1,
    });
    await updateGuestDisplay("demo", { guestId: ALEX_A, personName: "Alex K.", personContact: "" });
    const renamed = await getPublicReceipt("demo");
    assert.ok(renamed.claims.filter((claim) => claim.guestId === ALEX_A).every((claim) => claim.personName === "Alex K."));
    assert.equal(renamed.claims.find((claim) => claim.guestId === ALEX_B)?.personName, "Alex");
    assert.equal((await getTotals("demo")).people.filter((person) => person.personName === "Alex" || person.personName === "Alex K.").length, 2);
  });

  it("tells a same-name guest who already took the line, and rejects a bad guestId", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    assert.ok(juice);
    await addClaim("demo", {
      itemId: juice.id,
      guestId: ALEX_A,
      personName: "Alex",
      units: juice.qty,
    });
    await assert.rejects(
      () =>
        addClaim("demo", {
          itemId: juice.id,
          guestId: ALEX_B,
          personName: "Alex",
          units: 1,
        }),
      (err: unknown) => {
        const e = err as { code?: string; claimedBy?: string };
        assert.equal(e.code, "not_enough_remaining");
        assert.equal(e.claimedBy, "Alex");
        return true;
      },
    );
    await assert.rejects(
      () =>
        addClaim("demo", {
          itemId: juice.id,
          guestId: "not-a-uuid",
          personName: "Alex",
          units: 1,
        }),
      (err: unknown) => (err as { code?: string }).code === "invalid",
    );
  });
});
