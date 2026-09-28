import "server-only";

import {
  agentMaxToolCalls,
  agentMaxTurnsPerReceipt,
  hasOpenRouterKey,
} from "@/lib/agent/config";
import {
  heuristicCards,
  type AgentCard,
  type AgentSnapshot,
} from "@/lib/agent/heuristics";
import { phraseAgentTurn } from "@/lib/agent/openrouter";

export type AgentTurnRequest = {
  snapshot: AgentSnapshot;
  message?: string;
  /** Client-tracked turns for this receipt (1-based after this call). */
  turn?: number;
};

export type AgentTurnResponse = {
  message: string;
  cards: AgentCard[];
  model: string | null;
  usedLlm: boolean;
  turn: number;
  turnsRemaining: number;
};

function defaultMessage(cards: AgentCard[]): string {
  if (cards.length === 0) {
    return "Looks fine from here — keep reviewing the list, or tell me what’s off.";
  }
  if (cards.some((c) => c.kind === "set_tip") && cards.some((c) => c.kind === "set_pour")) {
    return "Tip looks blank and at least one line may be a bottle — apply what fits.";
  }
  if (cards.some((c) => c.kind === "set_tip")) {
    return "Tip is blank — add 20% or type what you left.";
  }
  return "A couple of lines look like shared bottles — split into glasses?";
}

/**
 * Phase 1 host co-pilot turn: heuristics always; optional Flash phrasing.
 * Mutations stay on the client (draft) until the host confirms cards.
 */
export async function runAgentTurn(req: AgentTurnRequest): Promise<AgentTurnResponse> {
  const turn = Math.max(1, Math.floor(req.turn ?? 1));
  const maxTurns = agentMaxTurnsPerReceipt();
  if (turn > maxTurns) {
    return {
      message: "Assistant cap reached for this tab — finish with the list.",
      cards: [],
      model: null,
      usedLlm: false,
      turn,
      turnsRemaining: 0,
    };
  }

  const allCards = heuristicCards(req.snapshot).slice(0, agentMaxToolCalls());
  let message = defaultMessage(allCards);
  let cards = allCards;
  let model: string | null = null;
  let usedLlm = false;

  const userMessage = req.message?.trim();
  const shouldCallLlm =
    hasOpenRouterKey() && (Boolean(userMessage) || allCards.length > 0);

  if (shouldCallLlm) {
    const llm = await phraseAgentTurn({
      cards: allCards,
      restaurant: req.snapshot.restaurant,
      itemCount: req.snapshot.items.length,
      feeCount: req.snapshot.fees.length,
      userMessage,
    });
    if (llm) {
      usedLlm = true;
      model = llm.model;
      message = llm.message;
      if (llm.keepCardIds.length > 0) {
        const want = new Set(llm.keepCardIds);
        const filtered = allCards.filter((c) => want.has(c.id));
        cards = filtered.length > 0 ? filtered : allCards;
      } else if (userMessage) {
        cards = [];
      }
    } else if (userMessage && !allCards.length) {
      message =
        "I couldn’t reach the model — edit the list directly, or try again in a moment.";
    }
  }

  return {
    message,
    cards,
    model,
    usedLlm,
    turn,
    turnsRemaining: Math.max(0, maxTurns - turn),
  };
}
