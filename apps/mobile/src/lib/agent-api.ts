import { api } from "@/lib/api";

export type AgentCardKind = "set_tip" | "set_pour" | "info";

export type AgentCard = {
  id: string;
  kind: AgentCardKind;
  title: string;
  detail: string;
  payload: Record<string, unknown>;
};

export type AgentTurnResponse = {
  message: string;
  cards: AgentCard[];
  model: string | null;
  usedLlm: boolean;
  turn: number;
  turnsRemaining: number;
};

export type AgentSnapshot = {
  restaurant?: string;
  items: {
    id: string;
    name: string;
    qty: number;
    totalCents: number;
    kind?: "food" | "drink" | null;
    pour?: { mode: "as_printed" | "glasses"; glassesPerPrintedUnit: number } | null;
  }[];
  fees: { id: string; name: string; amountCents: number }[];
};

const turnByReceipt = new Map<string, number>();

export function peekAgentTurn(receiptId: string): number {
  return turnByReceipt.get(receiptId) ?? 0;
}

export function resetAgentTurns(receiptId: string) {
  turnByReceipt.delete(receiptId);
}

export async function requestAgentTurn(opts: {
  receiptId: string;
  hostToken: string | null;
  snapshot: AgentSnapshot;
  message?: string;
}): Promise<AgentTurnResponse> {
  const nextTurn = (turnByReceipt.get(opts.receiptId) ?? 0) + 1;
  const res = await api<AgentTurnResponse>(`/api/receipts/${opts.receiptId}/agent`, {
    method: "POST",
    hostToken: opts.hostToken,
    body: JSON.stringify({
      snapshot: opts.snapshot,
      message: opts.message,
      turn: nextTurn,
    }),
  });
  turnByReceipt.set(opts.receiptId, res.turn);
  return res;
}
