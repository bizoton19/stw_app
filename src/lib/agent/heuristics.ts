import { pourCandidates, type PourSuggestion } from "@/lib/pour";
import type { Fee, Item } from "@/lib/types";

export type AgentCardKind = "set_tip" | "set_pour" | "info";

export type AgentCard = {
  id: string;
  kind: AgentCardKind;
  title: string;
  detail: string;
  /** Client applies these via draft setters — server does not mutate draft. */
  payload: Record<string, unknown>;
};

export type AgentSnapshot = {
  restaurant?: string;
  items: Pick<Item, "id" | "name" | "qty" | "totalCents" | "kind" | "pour">[];
  fees: Pick<Fee, "id" | "name" | "amountCents">[];
};

function moneyLabel(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function isTipFee(name: string): boolean {
  return /\b(tip|gratuity|service\s*charge|svc)\b/i.test(name);
}

function itemSubtotal(items: AgentSnapshot["items"]): number {
  return items.reduce((s, i) => s + Math.max(0, i.totalCents), 0);
}

/**
 * Free deterministic suggestions — no LLM.
 * Tip blank + bottle→glasses pour hints.
 */
export function heuristicCards(snapshot: AgentSnapshot): AgentCard[] {
  const cards: AgentCard[] = [];
  const items = snapshot.items.filter((i) => i.name.trim() && i.qty >= 1);
  const fees = snapshot.fees;
  const subtotal = itemSubtotal(items);

  const tipFee = fees.find((f) => isTipFee(f.name));
  const tipMissing = !tipFee || tipFee.amountCents <= 0;
  if (tipMissing && subtotal > 0) {
    const tipCents = Math.round(subtotal * 0.2);
    cards.push({
      id: "tip-20",
      kind: "set_tip",
      title: `Set tip to ${moneyLabel(tipCents)}`,
      detail: "20% of food and drink",
      payload: { amountCents: tipCents, name: "Tip" },
    });
  }

  const pours: PourSuggestion[] = pourCandidates(
    items.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      totalCents: i.totalCents,
      kind: i.kind ?? null,
      pour: i.pour ?? null,
    })),
  );

  for (const p of pours.slice(0, 3)) {
    cards.push({
      id: `pour-${p.itemId}`,
      kind: "set_pour",
      title: `Split into ${p.suggestGlasses} glasses`,
      detail: p.prompt,
      payload: {
        itemId: p.itemId,
        glassesPerPrintedUnit: p.suggestGlasses,
      },
    });
  }

  return cards;
}
