import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addClaim,
  addClaims,
  attachGuestClaims,
  getPublicReceipt,
  getTotals,
  removeClaim,
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

  it("separates same-name guests, keeps owner-token unclaim, and can stamp guestId later", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    const botanist = demo.items.find((item) => item.name === "The Botanist");
    assert.ok(juice && botanist);
    const alexA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const alexB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const first = await addClaim("demo", {
      itemId: juice.id,
      personName: "Alex",
      guestId: alexA,
      units: 1,
    });
    const second = await addClaim("demo", {
      itemId: botanist.id,
      personName: "Alex",
      guestId: alexB,
      units: 1,
    });
    assert.equal(first.claim.guestId, alexA);
    assert.equal(second.claim.guestId, alexB);

    const totals = await getTotals("demo");
    assert.equal(totals.people.length, 2);
    assert.equal(totals.people.filter((p) => p.personName === "Alex").length, 2);
    assert.notEqual(totals.people[0]?.guestId, totals.people[1]?.guestId);

    await assert.rejects(
      () => removeClaim(second.claim.id, "not-the-token", null),
      (err: unknown) => (err as { code?: string }).code === "forbidden",
    );
    await removeClaim(first.claim.id, first.ownerToken, null);
    const afterUnclaim = await getPublicReceipt("demo");
    assert.equal(afterUnclaim.claims.some((claim) => claim.id === first.claim.id), false);
    assert.equal(afterUnclaim.claims.length, 1);

    const legacy = await addClaim("demo", {
      itemId: juice.id,
      personName: "Alex",
      units: 1,
    });
    assert.equal(legacy.claim.guestId, undefined);
    const stamped = await attachGuestClaims("demo", {
      guestId: alexA,
      tokens: { [legacy.claim.id]: legacy.ownerToken, [second.claim.id]: "nope" },
    });
    assert.equal(stamped.updated, 1);
    const pub = await getPublicReceipt("demo");
    assert.equal(pub.claims.find((claim) => claim.id === legacy.claim.id)?.guestId, alexA);
    assert.equal(pub.claims.find((claim) => claim.id === second.claim.id)?.guestId, alexB);
    const split = await getTotals("demo");
    assert.equal(split.people.length, 2);
  });

  it("names the other Alex when the same display name races a full line", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    assert.ok(juice);
    const alexA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const alexB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await addClaim("demo", {
      itemId: juice.id,
      personName: "Alex",
      guestId: alexA,
      units: juice.qty,
    });
    await assert.rejects(
      () =>
        addClaim("demo", {
          itemId: juice.id,
          personName: "Alex",
          guestId: alexB,
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
          personName: "Alex",
          guestId: alexA,
          units: 1,
        }),
      (err: unknown) => {
        const e = err as { claimedBy?: string };
        assert.equal(e.claimedBy, undefined);
        return true;
      },
    );
  });

  it("rejects a guestId that is not a uuid", async () => {
    resetStoreForTests();
    const demo = await getPublicReceipt("demo");
    const juice = demo.items.find((item) => item.name === "Apple Juice");
    assert.ok(juice);
    await assert.rejects(
      () =>
        addClaim("demo", {
          itemId: juice.id,
          personName: "Alex",
          guestId: "Alex",
          units: 1,
        }),
      (err: unknown) => (err as { code?: string }).code === "invalid",
    );
  });
});
