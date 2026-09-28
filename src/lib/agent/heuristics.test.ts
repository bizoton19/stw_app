import type { AgentCard } from "@/lib/agent/heuristics";
import { heuristicCards } from "@/lib/agent/heuristics";

describe("heuristicCards", () => {
  it("suggests 20% tip when tip fee is missing", () => {
    const cards = heuristicCards({
      restaurant: "Test Bar",
      items: [
        { id: "i1", name: "Negroni", qty: 1, totalCents: 1600, kind: "drink", pour: null },
        { id: "i2", name: "Fries", qty: 1, totalCents: 900, kind: "food", pour: null },
      ],
      fees: [{ id: "f1", name: "Tax", amountCents: 200 }],
    });
    const tip = cards.find((c) => c.kind === "set_tip");
    expect(tip).toBeTruthy();
    expect((tip as AgentCard).payload.amountCents).toBe(500);
  });

  it("skips tip when tip already set", () => {
    const cards = heuristicCards({
      items: [{ id: "i1", name: "Beer", qty: 1, totalCents: 1000, kind: "drink", pour: null }],
      fees: [{ id: "f1", name: "Tip", amountCents: 200 }],
    });
    expect(cards.some((c) => c.kind === "set_tip")).toBe(false);
  });
});
