import { sumCents, unitCentsArray } from "./money";
import type { Claim, Item, PersonTotal, Receipt, Totals } from "./types";

export function remainingForItem(item: Item, claims: Claim[]): number {
  const used = claims.filter((c) => c.itemId === item.id).reduce((s, c) => s + c.units, 0);
  return item.qty - used;
}

export function latestClaimerForItem(
  claims: Claim[],
  itemId: string,
  excludeName?: string,
): string | undefined {
  const rows = claims
    .filter(
      (c) =>
        c.itemId === itemId &&
        (!excludeName || c.personName.trim().toLowerCase() !== excludeName.trim().toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return rows[0]?.personName;
}

type UnitOwner = { personName: string; personContact?: string };

function ownersForItem(item: Item, claims: Claim[]): UnitOwner[] {
  const ordered = claims
    .filter((c) => c.itemId === item.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const owners: UnitOwner[] = [];
  for (const claim of ordered) {
    for (let i = 0; i < claim.units; i++) {
      owners.push({ personName: claim.personName, personContact: claim.personContact });
    }
  }
  return owners;
}

export function computeTotals(receipt: Receipt): Totals {
  const itemSubtotalCents = sumCents(receipt.items.map((i) => i.totalCents));
  const feeTotalCents = sumCents(receipt.fees.map((f) => f.amountCents));
  const peopleMap = new Map<string, PersonTotal>();

  function person(name: string, contact?: string): PersonTotal {
    let row = peopleMap.get(name);
    if (!row) {
      row = {
        personName: name,
        personContact: contact,
        itemCents: 0,
        feeCents: 0,
        totalCents: 0,
        lines: [],
      };
      peopleMap.set(name, row);
    } else if (contact && !row.personContact) {
      row.personContact = contact;
    }
    return row;
  }

  let claimedItemCents = 0;
  for (const item of receipt.items) {
    const units = unitCentsArray(item.totalCents, item.qty);
    const owners = ownersForItem(item, receipt.claims);
    const byPerson = new Map<string, { units: number; cents: number; contact?: string }>();
    owners.forEach((owner, idx) => {
      const cents = units[idx] ?? 0;
      claimedItemCents += cents;
      const agg = byPerson.get(owner.personName) ?? {
        units: 0,
        cents: 0,
        contact: owner.personContact,
      };
      agg.units += 1;
      agg.cents += cents;
      if (owner.personContact) agg.contact = owner.personContact;
      byPerson.set(owner.personName, agg);
    });
    for (const [name, agg] of byPerson) {
      const row = person(name, agg.contact);
      row.itemCents += agg.cents;
      row.lines.push({
        itemId: item.id,
        itemName: item.name,
        units: agg.units,
        cents: agg.cents,
      });
    }
  }

  const people = [...peopleMap.values()].sort((a, b) => a.personName.localeCompare(b.personName));
  const feeWeights = [...people.map((row) => row.itemCents), itemSubtotalCents - claimedItemCents];
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
