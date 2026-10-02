import { sumCents, unitCentsArray } from "./money";
import { claimCapacity, isGlassesPour } from "./pour";
import type { Claim, Item, PersonTotal, Receipt, Totals } from "./types";

export function remainingForItem(item: Item, claims: Claim[]): number {
  const used = claims
    .filter((c) => c.itemId === item.id)
    .reduce((s, c) => s + c.units, 0);
  return claimCapacity(item) - used;
}

/** Most recent claimer on a line (for race-loss copy). */
export function latestClaimerForItem(
  claims: Claim[],
  itemId: string,
  exclude?: string | { guestId?: string; personName?: string },
): string | undefined {
  const excludeGuestId = typeof exclude === "object" ? exclude?.guestId : undefined;
  const excludeName = typeof exclude === "string" ? exclude : exclude?.personName;
  const rows = claims
    .filter((c) => {
      if (c.itemId !== itemId) return false;
      if (excludeGuestId) return c.guestId !== excludeGuestId;
      if (
        excludeName &&
        c.personName.trim().toLowerCase() === excludeName.trim().toLowerCase()
      ) {
        return false;
      }
      return true;
    })
    .sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
  return rows[0]?.personName;
}

/** This device's row. A guestId never matches a different person who shares the display name. */
export function personForGuest<T extends { guestId?: string; personName: string }>(
  people: T[],
  guest: { guestId?: string; name: string } | null | undefined,
): T | undefined {
  if (!guest) return undefined;
  if (guest.guestId) return people.find((p) => p.guestId === guest.guestId);
  return people.find((p) => !p.guestId && p.personName === guest.name);
}

export function remainingMap(receipt: Pick<Receipt, "items" | "claims">): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of receipt.items) {
    map[item.id] = remainingForItem(item, receipt.claims);
  }
  return map;
}

type UnitOwner = {
  guestId?: string;
  personName: string;
  personContact?: string;
  createdAt: string;
};

function personKey(owner: { guestId?: string; personName: string }): string {
  if (owner.guestId) return `id:${owner.guestId}`;
  return `name:${owner.personName}`;
}

function ownersForItem(item: Item, claims: Claim[]): UnitOwner[] {
  const ordered = claims
    .filter((c) => c.itemId === item.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const owners: UnitOwner[] = [];
  for (const claim of ordered) {
    for (let i = 0; i < claim.units; i++) {
      owners.push({
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
  type PersonAcc = PersonTotal & { latestAt: string };
  const peopleMap = new Map<string, PersonAcc>();

  function touch(owner: UnitOwner): PersonAcc {
    const key = personKey(owner);
    let row = peopleMap.get(key);
    if (!row) {
      row = {
        guestId: owner.guestId,
        personName: owner.personName,
        personContact: owner.personContact,
        itemCents: 0,
        feeCents: 0,
        totalCents: 0,
        lines: [],
        latestAt: owner.createdAt,
      };
      peopleMap.set(key, row);
      return row;
    }
    if (owner.createdAt >= row.latestAt) {
      row.personName = owner.personName;
      row.latestAt = owner.createdAt;
      if (owner.personContact) row.personContact = owner.personContact;
    } else if (owner.personContact && !row.personContact) {
      row.personContact = owner.personContact;
    }
    return row;
  }

  let claimedItemCents = 0;

  for (const item of receipt.items) {
    const capacity = claimCapacity(item);
    const units = unitCentsArray(item.totalCents, capacity);
    const owners = ownersForItem(item, receipt.claims);
    const byPerson = new Map<
      string,
      {
        guestId?: string;
        personName: string;
        contact?: string;
        units: number;
        cents: number;
        createdAt: string;
      }
    >();
    owners.forEach((owner, idx) => {
      const cents = units[idx] ?? 0;
      claimedItemCents += cents;
      const key = personKey(owner);
      const agg = byPerson.get(key) ?? {
        guestId: owner.guestId,
        personName: owner.personName,
        contact: owner.personContact,
        units: 0,
        cents: 0,
        createdAt: owner.createdAt,
      };
      agg.units += 1;
      agg.cents += cents;
      if (owner.createdAt >= agg.createdAt) {
        agg.personName = owner.personName;
        agg.createdAt = owner.createdAt;
        if (owner.personContact) agg.contact = owner.personContact;
      } else if (owner.personContact && !agg.contact) {
        agg.contact = owner.personContact;
      }
      byPerson.set(key, agg);
    });
    for (const agg of byPerson.values()) {
      const row = touch({
        guestId: agg.guestId,
        personName: agg.personName,
        personContact: agg.contact,
        createdAt: agg.createdAt,
      });
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
    .map(({ latestAt: _latestAt, ...row }) => {
      void _latestAt;
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
