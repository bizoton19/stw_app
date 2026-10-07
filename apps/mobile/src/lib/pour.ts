import { remainingLineCents, unitPriceCents } from "./money";
import type { Item, ItemKind, ItemPour } from "./types";

export const DEFAULT_GLASSES_PER_BOTTLE = 6;
export const MIN_GLASSES_PER_UNIT = 2;
export const MAX_GLASSES_PER_UNIT = 24;

/**
 * Per printed unit — above this, ask the host if a drink line is a bottle
 * even when the name doesn’t say “bottle” / wine.
 */
export const BOTTLE_PRICE_HINT_CENTS = 4500;

const ALREADY_GLASS = /\b(glasses?|gls|gl\.?|pours?|flutes?|cups?|shots?)\b/i;
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
  /** Internal only — never show in UI. */
  confidence: "high" | "med" | "low";
  /**
   * User-facing suggestion. For ambiguous lines this is the resolve question
   * (e.g. “$60 Cabernet looks like a shared bottle — want to split it?”).
   */
  prompt: string;
  /**
   * True when confidence is below “high”: host must explicitly choose;
   * do not pre-select “split into glasses.”
   */
  needsResolve: boolean;
};

function moneyLabel(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function suggestion(
  base: Omit<PourSuggestion, "needsResolve" | "prompt"> & { prompt: string },
): PourSuggestion {
  return {
    ...base,
    needsResolve: base.confidence !== "high",
  };
}

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

/** Claim-row motif: carafe for a shared/split pour, stem for a single drink. */
export function usesCarafeMotif(item: Pick<Item, "name" | "pour">): boolean {
  if (isGlassesPour(item)) return true;
  return CARAFE.test(item.name ?? "");
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

function kindOf(item: { kind?: ItemKind | null }): ItemKind | null {
  if (item.kind === "food" || item.kind === "drink") return item.kind;
  return null;
}

export function suggestPourForItem(item: {
  id: string;
  name: string;
  qty: number;
  totalCents: number;
  kind?: ItemKind | null;
  pour?: ItemPour | null;
}): PourSuggestion | null {
  if (item.pour?.mode === "glasses" || item.pour?.mode === "as_printed") return null;
  const name = item.name.trim();
  if (!name) return null;
  if (kindOf(item) === "food") return null;
  if (ALREADY_GLASS.test(name) && !BOTTLE.test(name) && !MAGNUM.test(name)) {
    return null;
  }
  if (SKIP_DRINK.test(name) && !BOTTLE.test(name) && !SPARKLING.test(name) && !MAGNUM.test(name)) {
    return null;
  }
  if (CARAFE.test(name)) {
    return suggestion({
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: "low",
      prompt: `${name} · ${moneyLabel(item.totalCents)} looks shareable — split into glasses?`,
    });
  }
  if (MAGNUM.test(name)) {
    return suggestion({
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: 12,
      confidence: "high",
      prompt: "Magnum — usually about 12 glasses",
    });
  }
  if (SPARKLING.test(name) && (BOTTLE.test(name) || MAGNUM.test(name) || item.totalCents >= 6000)) {
    const high = BOTTLE.test(name) || MAGNUM.test(name);
    return suggestion({
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: high ? "high" : "med",
      prompt: high
        ? "Champagne / sparkling — often about 6 flutes"
        : `${name} · ${moneyLabel(item.totalCents)} looks like a shared bottle — want to split it?`,
    });
  }
  if (BOTTLE.test(name)) {
    return suggestion({
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: "high",
      prompt: "Bottle — often about 6 glasses",
    });
  }
  const drinkish = kindOf(item) === "drink" || WINE_PACKAGE.test(name);
  if (drinkish && item.qty <= 2 && item.totalCents >= 5000 && WINE_PACKAGE.test(name)) {
    return suggestion({
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: "med",
      prompt: `${name} · ${moneyLabel(item.totalCents)} looks like a shared bottle — want to split it?`,
    });
  }
  const unitCents = Math.round(item.totalCents / Math.max(1, item.qty));
  if (kindOf(item) === "drink" && item.qty <= 3 && unitCents >= BOTTLE_PRICE_HINT_CENTS) {
    return suggestion({
      itemId: item.id,
      name,
      totalCents: item.totalCents,
      printedQty: item.qty,
      suggestGlasses: DEFAULT_GLASSES_PER_BOTTLE,
      confidence: "low",
      prompt: `${name} · ${moneyLabel(unitCents)} looks like a shared bottle — want to split it?`,
    });
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
