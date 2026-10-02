import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUEST_STORAGE_PREFIX,
  claimPersonFields,
  guestStorageKey,
  isGuestId,
  mergeGuestIdentity,
  normalizeGuestId,
  parseStoredGuest,
  relabelGuestClaims,
} from "./guest-id";
import { computeTotals, personForGuest } from "./totals";
import type { Receipt } from "./types";

const ALEX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALEX_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("guestId contract", () => {
  it("uses the stw-guest key prefix per receipt", () => {
    assert.equal(GUEST_STORAGE_PREFIX, "stw-guest:");
    assert.equal(guestStorageKey("rec_1"), "stw-guest:rec_1");
  });

  it("accepts a UUID and rejects anything else", () => {
    assert.equal(isGuestId(ALEX_A), true);
    assert.equal(normalizeGuestId(`  ${ALEX_A.toUpperCase()}  `), ALEX_A);
    assert.equal(normalizeGuestId(""), undefined);
    assert.equal(normalizeGuestId(undefined), undefined);
    assert.throws(() => normalizeGuestId("alex"), (err: unknown) => {
      return (err as { code?: string }).code === "invalid";
    });
  });

  it("parses stored JSON and drops a bad guestId", () => {
    assert.deepEqual(parseStoredGuest(JSON.stringify({ name: "Alex", contact: "@a" })), {
      guestId: undefined,
      name: "Alex",
      contact: "@a",
    });
    assert.equal(
      parseStoredGuest(JSON.stringify({ guestId: ALEX_A, name: "Alex", contact: "" }))?.guestId,
      ALEX_A,
    );
    assert.equal(parseStoredGuest("{"), null);
    assert.equal(parseStoredGuest(JSON.stringify({ guestId: ALEX_A })) , null);
  });

  it("keeps guestId when the display name changes", () => {
    const first = mergeGuestIdentity(null, { name: "Alex", contact: "" });
    assert.equal(isGuestId(first.guestId), true);
    const renamed = mergeGuestIdentity(first, { name: "Alexis", contact: "@a" });
    assert.equal(renamed.guestId, first.guestId);
    assert.equal(renamed.name, "Alexis");
    const explicit = mergeGuestIdentity(first, { guestId: ALEX_B, name: "Sam" });
    assert.equal(explicit.guestId, ALEX_B);
  });

  it("relabels only claims for that guestId", () => {
    const claims = [
      { guestId: ALEX_A, personName: "Alex", personContact: undefined },
      { guestId: ALEX_B, personName: "Alex", personContact: "@b" },
      { guestId: ALEX_A, personName: "Alex", autoLeftover: true, personContact: undefined },
    ];
    relabelGuestClaims(claims, ALEX_A, "Alexis", "@a");
    assert.equal(claims[0].personName, "Alexis");
    assert.equal(claims[0].personContact, "@a");
    assert.equal(claims[1].personName, "Alex");
    assert.equal(claims[2].personName, "Alex");
  });
});

function receipt(claims: Receipt["claims"]): Receipt {
  return {
    id: "r",
    status: "open",
    restaurant: "Demo",
    items: [
      { id: "wine", name: "Wine", qty: 2, totalCents: 2000 },
      { id: "juice", name: "Juice", qty: 1, totalCents: 500 },
    ],
    fees: [{ id: "tax", name: "Tax", amountCents: 250 }],
    claims,
    createdAt: "2026-10-02T00:00:00.000Z",
  };
}

describe("totals keyed by guestId", () => {
  it("keeps two guests with the same display name apart", () => {
    const totals = computeTotals(
      receipt([
        {
          id: "c1",
          itemId: "wine",
          guestId: ALEX_A,
          personName: "Alex",
          units: 1,
          createdAt: "2026-10-02T00:00:01.000Z",
        },
        {
          id: "c2",
          itemId: "wine",
          guestId: ALEX_B,
          personName: "Alex",
          units: 1,
          createdAt: "2026-10-02T00:00:02.000Z",
        },
      ]),
    );
    assert.equal(totals.people.length, 2);
    assert.equal(totals.people.filter((p) => p.personName === "Alex").length, 2);
    const a = personForGuest(totals.people, { guestId: ALEX_A, name: "Alex" });
    const b = personForGuest(totals.people, { guestId: ALEX_B, name: "Alex" });
    assert.ok(a && b);
    assert.notEqual(a.itemCents, 0);
    assert.notEqual(b.itemCents, 0);
    assert.equal(a.itemCents + b.itemCents, 2000);
    assert.ok(a.feeCents > 0 && b.feeCents > 0);
    assert.equal(a.totalCents + b.totalCents, 2200);
  });

  it("merges one guestId even when the cosmetic name changes", () => {
    const totals = computeTotals(
      receipt([
        {
          id: "c1",
          itemId: "wine",
          guestId: ALEX_A,
          personName: "Alex",
          units: 1,
          createdAt: "2026-10-02T00:00:01.000Z",
        },
        {
          id: "c2",
          itemId: "juice",
          guestId: ALEX_A,
          personName: "Alexis",
          units: 1,
          createdAt: "2026-10-02T00:00:02.000Z",
        },
      ]),
    );
    assert.equal(totals.people.length, 1);
    assert.equal(totals.people[0].guestId, ALEX_A);
    assert.equal(totals.people[0].personName, "Alexis");
    assert.equal(totals.people[0].lines.length, 2);
  });

  it("still merges legacy claims that have no guestId by exact name", () => {
    const totals = computeTotals(
      receipt([
        {
          id: "c1",
          itemId: "wine",
          personName: "Sam",
          units: 1,
          createdAt: "2026-10-02T00:00:01.000Z",
        },
        {
          id: "c2",
          itemId: "juice",
          personName: "Sam",
          units: 1,
          createdAt: "2026-10-02T00:00:02.000Z",
        },
      ]),
    );
    assert.equal(totals.people.length, 1);
    assert.equal(totals.people[0].guestId, undefined);
    assert.equal(totals.people[0].personName, "Sam");
  });

  it("does not treat another person with the same name as mine", () => {
    const people = computeTotals(
      receipt([
        {
          id: "c1",
          itemId: "juice",
          guestId: ALEX_B,
          personName: "Alex",
          units: 1,
          createdAt: "2026-10-02T00:00:01.000Z",
        },
      ]),
    ).people;
    assert.equal(personForGuest(people, { guestId: ALEX_A, name: "Alex" }), undefined);
    assert.equal(personForGuest(people, { name: "Alex" })?.guestId, undefined);
  });
});

describe("claimPersonFields", () => {
  it("requires a name and passes through a valid guestId", () => {
    assert.deepEqual(claimPersonFields({ guestId: ALEX_A, personName: " Alex ", personContact: " @a " }), {
      guestId: ALEX_A,
      personName: "Alex",
      personContact: "@a",
    });
    assert.throws(() => claimPersonFields({ personName: "  " }), (err: unknown) => {
      return (err as { code?: string }).code === "invalid";
    });
  });
});
