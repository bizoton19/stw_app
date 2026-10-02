import { personRowKey } from "./guest-id";
import { sumCents, unitCentsArray } from "./money";
import { claimCapacity, isGlassesPour } from "./pour";
import type { Claim, Item, PersonTotal, Receipt, Totals } from "./types";

export function remainingForItem(item: Item, claims: Claim[]): number {
  const used = claims
    .filter((c) => c.itemId === item.id)
    .reduce((s, c) => s + c.units, 0);
  return claimCapacity(item) - used;
}

/**
 * Most recent other claimer on a line (for race-loss copy).
 * When `excludeGuestId` is set, only that id is skipped — a same display name
 * with a different guestId still counts. Legacy callers pass a name only.
 */
export function latestClaimerForItem(
  claims: Claim[],
  itemId: string,
  excludeName?: string,
  excludeGuestId?: string,
): string | undefined {
  const excludeId = excludeGuestId?.trim().toLowerCase() || undefined;
  const exclude = excludeName?.trim().toLowerCase() || undefined;
  const rows = claims
    .filter((c) => {
      if (c.itemId !== itemId) return false;
      if (excludeId) return c.guestId?.trim().toLowerCase() !== excludeId;
      if (exclude && c.personName.trim().toLowerCase() === exclude) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return rows[0]?.personName;
}

export function remainingMap(receipt: Pick<Receipt, "items" | "claims">): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of receipt.items) {
    map[item.id] = remainingForItem(item, receipt.claims);
  }
  return map;
}

type UnitOwner = {
  key: string;
  guestId?: string;
  personName: string;
  personContact?: string;
  createdAt: string;
};

function ownersForItem(item: Item, claims: Claim[]): UnitOwner[] {
  const ordered = claims
    .filter((c) => c.itemId === item.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const owners: UnitOwner[] = [];
  for (const claim of ordered) {
    for (let i = 0; i < claim.units; i++) {
      owners.push({
        key: personRowKey(claim),
        guestId: claim.guestId,
        personName: claim.personName,
        personContact: claim.personContact,
        createdAt: claim.createdAt,
      });
    }
  }
  return owners;
}

function lineItemName(item: Item): string {
  if (isGlassesPour(item)) return `${item.name} (glass)`;
  return item.name;
}

export function computeTotals(receipt: Receipt): Totals {
  const itemSubtotalCents = sumCents(receipt.items.map((i) => i.totalCents));
  const feeTotalCents = sumCents(receipt.fees.map((f) => f.amountCents));
  const peopleMap = new Map<string, PersonTotal & { seenAt: string }>();

  function person(owner: UnitOwner): PersonTotal & { seenAt: string } {
    let row = peopleMap.get(owner.key);
    if (!row) {
      row = {
        guestId: owner.guestId,
        personName: owner.personName,
        personContact: owner.personContact,
        itemCents: 0,
        feeCents: 0,
        totalCents: 0,
        lines: [],
        seenAt: owner.createdAt,
      };
      peopleMap.set(owner.key, row);
      return row;
    }
    const newer = owner.createdAt >= row.seenAt;
    if (newer) {
      row.seenAt = owner.createdAt;
      if (owner.personName.trim()) row.personName = owner.personName;
      if (owner.guestId) row.guestId = owner.guestId;
    }
    if (owner.personContact && (newer || !row.personContact)) {
      row.personContact = owner.personContact;
    }
    return row;
  }

  let claimedItemCents = 0;

  for (const item of receipt.items) {
    const capacity = claimCapacity(item);
    const units = unitCentsArray(item.totalCents, capacity);
    const owners = ownersForItem(item, receipt.claims);
    const byPerson = new Map<string, { units: number; cents: number; owner: UnitOwner }>();
    owners.forEach((owner, idx) => {
      const cents = units[idx] ?? 0;
      claimedItemCents += cents;
      const agg = byPerson.get(owner.key) ?? { units: 0, cents: 0, owner };
      agg.units += 1;
      agg.cents += cents;
      if (owner.createdAt >= agg.owner.createdAt) agg.owner = owner;
      else if (owner.personContact && !agg.owner.personContact) {
        agg.owner = { ...agg.owner, personContact: owner.personContact };
      }
      byPerson.set(owner.key, agg);
    });
    for (const agg of byPerson.values()) {
      const row = person(agg.owner);
      row.itemCents += agg.cents;
      row.lines.push({
        itemId: item.id,
        itemName: lineItemName(item),
        units: agg.units,
        cents: agg.cents,
      });
    }
  }

  const people = [...peopleMap.values()]
    .map(({ seenAt, ...row }) => {
      void seenAt;
      return row;
    })
    .sort(
      (a, b) =>
        a.personName.localeCompare(b.personName) ||
        (a.guestId ?? "").localeCompare(b.guestId ?? ""),
    );

  const feeWeights = [
    ...people.map((row) => row.itemCents),
    itemSubtotalCents - claimedItemCents,
  ];
  if (feeTotalCents > 0 && itemSubtotalCents > 0) {
    const fees = allocateProportional(feeTotalCents, feeWeights);
    people.forEach((row, idx) => {
      row.feeCents = fees[idx] ?? 0;
    });
  }

  for (const row of people) {
    row.totalCents = row.itemCents + row.feeCents;
  }

  return {
    itemSubtotalCents,
    feeTotalCents,
    grandTotalCents: itemSubtotalCents + feeTotalCents,
    claimedItemCents,
    unclaimedItemCents: itemSubtotalCents - claimedItemCents,
    people,
  };
}

/**
 * Guest's proportional share (items + tax & tip).
 * `extra` is the in-progress claim queue — not yet saved — so the board can
 * show a quiet running total while someone is still tapping lines.
 */
export function shareSoFarCents(
  receipt: Receipt,
  personName: string,
  extra: { itemId: string; units: number }[] = [],
): number {
  const name = personName.trim();
  if (!name) return 0;
  const extras: Claim[] = extra
    .filter((row) => row.units > 0)
    .map((row, i) => ({
      id: `preview_${i}`,
      itemId: row.itemId,
      personName: name,
      units: row.units,
      createdAt: `9999-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
    }));
  const hasShare =
    extras.length > 0 || receipt.claims.some((claim) => claim.personName === name);
  if (!hasShare) return 0;
  const totals = computeTotals({
    ...receipt,
    claims: [...receipt.claims, ...extras],
  });
  return totals.people.find((person) => person.personName === name)?.totalCents ?? 0;
}

export function leftoverAssignments(receipt: Receipt): { itemId: string; units: number }[] {
  const remaining = remainingMap(receipt);
  return receipt.items
    .map((item) => ({ itemId: item.id, units: remaining[item.id] ?? 0 }))
    .filter((row) => row.units > 0);
}

export function allocateProportional(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  const rem = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, i) => ({ i, frac: value - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < rem; k++) {
    out[order[k % order.length].i] += 1;
  }
  return out;
}
