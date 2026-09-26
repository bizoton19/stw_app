import { remainingLineCents, unitPriceCents } from "./money";
import type { Item, ItemKind, ItemPour } from "./types";

export const DEFAULT_GLASSES_PER_BOTTLE = 6;
export const MIN_GLASSES_PER_UNIT = 2;
export const MAX_GLASSES_PER_UNIT = 24;

/** Printed check units that already look like glasses — don't offer bottle split. */
const ALREADY_GLASS =
  /\b(glasses?|gls|pours?|flutes?|cups?|shots?)\b/i;

const MAGNUM = /\b(magnum|1\.5\s*l(?:itre|iter)?s?|1500\s*ml)\b/i;
const BOTTLE =
  /\b(bottles?|btls?|btl\.?|750\s*ml|75\s*cl|wine\s*pkg|wine\s*package|bottle\s*package)\b/i;
const SPARKLING =
  /\b(champagne|prosecco|cava|sparkling|brut|ros[eé]\s*brut|dom\s*p[eé]rignon|veuve|mo[eë]t)\b/i;
const WINE_PACKAGE =
  /\b(package|pkg|pkg\.|wine|vino|cabernet|pinot|chardonnay|merlot|sauvignon|riesling|malbec|syrah|shiraz|tempranillo|bordeaux|burgundy|chianti|barolo|rioja|nebbiolo|sancerre|blanc|rouge)\b/i;
const CARAFE = /\b(carafe|pitcher|decanter)\b/i;
const SKIP_DRINK =
  /\b(beer|ale|lager|ipa|stout|cocktail|negroni|martini|mocktail|soda|cola|juice|coffee|espresso|latte|tea|water)\b/i;

export type PourSuggestion = {
  itemId: string;
  name: string;
  totalCents: number;
  printedQty: number;
  suggestGlasses: number;
  confidence: "high" | "med" | "low";
  label: string;
};

export function claimCapacity(item: Pick<Item, "qty" | "pour">): number {
  const pour = item.pour;
  if (pour?.mode === "glasses" && pour.glassesPerPrintedUnit > 0) {
    return Math.max(1, item.qty * pour.glassesPerPrintedUnit);
  }
  return Math.max(1, item.qty);
}

export function isGlassesPour(item: Pick<Item, "pour">): boolean {
  return item.pour?.mode === "glasses" && (item.pour.glassesPerPrintedUnit ?? 0) > 0;
}

export function claimUnitLabel(item: Pick<Item, "pour">, n: number): string {
  if (isGlassesPour(item)) return n === 1 ? "glass" : "glasses";
  return n === 1 ? "left" : "left";
}

export function normalizePour(pour: ItemPour | null | undefined): ItemPour | undefined {
  if (!pour) return undefined;
  if (pour.mode === "as_printed") {
    return { mode: "as_printed", glassesPerPrintedUnit: 1 };
  }
  const glasses = Math.min(
    MAX_GLASSES_PER_UNIT,
    Math.max(MIN_GLASSES_PER_UNIT, Math.round(pour.glassesPerPrintedUnit) || DEFAULT_GLASSES_PER_BOTTLE),
  );
  return { mode: "glasses", glassesPerPrintedUnit: glasses };
}

function kindOf(item: { kind?: ItemKind | null; name: string }): ItemKind | null {
  if (item.kind === "food" || item.kind === "drink") return item.kind;
  return null;
}

/**
 * Heuristic: should we ask the host whether to split this printed line into glasses?
 */
export function suggestPourForItem(item: {
  id: string;
  name: string;
  qty: number;
  totalCents: number;
  kind?: ItemKind | null;
  pour?: ItemPour | null;
}): PourSuggestion | null {
  if (item.pour?.mode === "glasses" || item.pour?.mode === "as_printed") {
    // Already decided for this draft/receipt.
    return null;
  }
  const name = item.name.trim();
  if (!name) return null;
  if (kindOf(item) === "food") return null;
  if (ALREADY_GLASS.test(name) && item.qty >= 4) return null;
  if (SKIP_DRINK.test(name) && !BOTTLE.test(name) && !SPARKLING.test(name) && !MAGNUM.test(name)) {
    return null;
  }
  if (CARAFE.test(name)) {
    return {
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: "low",
      label: "Carafe / pitcher — confirm pour size",
    };
  }

  if (MAGNUM.test(name)) {
    return {
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: 12,
      confidence: "high",
      label: "Magnum — usually ~12 glasses",
    };
  }

  if (SPARKLING.test(name) && (BOTTLE.test(name) || item.qty <= 2 || item.totalCents >= 4000)) {
    return {
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: BOTTLE.test(name) ? "high" : "med",
      label: "Champagne / sparkling — often ~6 flutes",
    };
  }

  if (BOTTLE.test(name)) {
    return {
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: "high",
      label: "Bottle — often ~6 glasses",
    };
  }

  // Wine package / pricey drink line that looks shareable.
  const drinkish = kindOf(item) === "drink" || WINE_PACKAGE.test(name);
  if (drinkish && item.qty <= 2 && item.totalCents >= 5000 && WINE_PACKAGE.test(name)) {
    return {
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: "med",
      label: "Wine package — often 1 bottle ≈ 6 glasses",
    };
  }

  return null;
}

export function pourCandidates(
  items: {
    id: string;
    name: string;
    qty: number;
    totalCents: number;
    kind?: ItemKind | null;
    pour?: ItemPour | null;
    removed?: boolean;
  }[],
): PourSuggestion[] {
  return items
    .filter((item) => !item.removed)
    .map((item) => suggestPourForItem(item))
    .filter((row): row is PourSuggestion => Boolean(row));
}

export function pourAsPrinted(): ItemPour {
  return { mode: "as_printed", glassesPerPrintedUnit: 1 };
}

export function pourAsGlasses(glassesPerPrintedUnit: number): ItemPour {
  return normalizePour({
    mode: "glasses",
    glassesPerPrintedUnit,
  })!;
}

/** Unit price + remaining cents using claim capacity (glasses or printed qty). */
export function claimMoneySlice(
  item: Pick<Item, "totalCents" | "qty" | "pour">,
  left: number,
): { capacity: number; unitCents: number; remainingCents: number; glasses: boolean } {
  const capacity = claimCapacity(item);
  return {
    capacity,
    unitCents: unitPriceCents(item.totalCents, capacity),
    remainingCents: remainingLineCents(item.totalCents, capacity, left),
    glasses: isGlassesPour(item),
  };
}
