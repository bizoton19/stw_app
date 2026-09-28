import "server-only";

import {
  agentMaxTokens,
  agentModel,
  hasOpenRouterKey,
} from "@/lib/agent/config";
import type { AgentCard, AgentSnapshot } from "@/lib/agent/heuristics";
import { offTopicRefusal } from "@/lib/agent/scope";

const SYSTEM = `You are the Split the Wine host assistant for ONE restaurant/bar check.

IN SCOPE only (answer these):
- Line items on this draft (names, qty, prices, food vs drink)
- Fees on this draft (tax, tip, service, cash tip left blank)
- Simple math from THIS data (subtotals, 15/18/20% tip, split of a line)
- Bottle vs glasses / pour suggestions
- What is missing or looks wrong on the draft
- Clarifying questions about the draft data
- Local tax/tip customs only as brief help for entering fees on THIS check (not legal advice)

OUT OF SCOPE (refuse — set onTopic false, keepCardIds [], short refusal):
- General chat, jokes, weather, news, coding, politics, other apps
- Topics unrelated to splitting THIS check
- Inventing items/fees that are not on the draft or suggested cards
- Claiming items for guests, sending money, or Venmo/Cash App login help beyond “enter your handle in Pay”

Rules:
- Never invent money amounts not grounded in the draft numbers or suggested cards.
- Prefer asking a short clarifying question when the draft is ambiguous.
- message: 1–3 short sentences.
- onTopic: false when the host asks anything outside IN SCOPE.
- keepCardIds: only ids from the provided list that still help; empty if refusing or none apply.
Return JSON only.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    onTopic: { type: "boolean" },
    message: { type: "string" },
    keepCardIds: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["onTopic", "message", "keepCardIds"],
} as const;

function contentText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as { content?: unknown };
  const content = msg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function salvageJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("agent_bad_json");
  }
}

function moneyLabel(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function draftContext(snapshot: AgentSnapshot): string {
  const items = snapshot.items.slice(0, 40);
  const fees = snapshot.fees.slice(0, 20);
  const itemSum = items.reduce((s, i) => s + Math.max(0, i.totalCents), 0);
  const feeSum = fees.reduce((s, f) => s + Math.max(0, f.amountCents), 0);
  const itemLines = items
    .map(
      (i) =>
        `- [${i.id}] ${i.name} ×${i.qty} ${moneyLabel(i.totalCents)}` +
        (i.kind ? ` (${i.kind})` : "") +
        (i.pour?.mode === "glasses"
          ? ` [glasses×${i.pour.glassesPerPrintedUnit}]`
          : ""),
    )
    .join("\n");
  const feeLines = fees
    .map((f) => `- [${f.id}] ${f.name}: ${moneyLabel(f.amountCents)}`)
    .join("\n");
  return [
    `Venue: ${snapshot.restaurant?.trim() || "(unknown)"}`,
    `Item subtotal: ${moneyLabel(itemSum)} · Fees: ${moneyLabel(feeSum)} · Grand: ${moneyLabel(itemSum + feeSum)}`,
    `Items (${items.length}):`,
    itemLines || "(none)",
    `Fees (${fees.length}):`,
    feeLines || "(none)",
  ].join("\n");
}

export type AgentLlmResult = {
  onTopic: boolean;
  message: string;
  keepCardIds: string[];
  model: string;
};

/**
 * One cheap Flash call scoped to this draft — not a general chatbot.
 */
export async function phraseAgentTurn(opts: {
  cards: AgentCard[];
  snapshot: AgentSnapshot;
  userMessage?: string;
  abortMs?: number;
}): Promise<AgentLlmResult | null> {
  if (!hasOpenRouterKey()) return null;
  const key = process.env.OPENROUTER_API_KEY!.trim();
  const model = agentModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.abortMs ?? 12_000);
  const cardLines = opts.cards
    .map((c) => `- id=${c.id} | ${c.title} | ${c.detail}`)
    .join("\n");
  const userText = [
    draftContext(opts.snapshot),
    `Suggested action cards:`,
    cardLines || "(none)",
    opts.userMessage?.trim()
      ? `Host said: ${opts.userMessage.trim()}`
      : "Host opened the assistant (no message).",
  ].join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://127.0.0.1:43147",
        "X-Title": "Split the Wine Agent",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: agentMaxTokens(),
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userText },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_turn",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
        provider: { require_parameters: true },
      }),
    });
    const payload = (await res.json()) as {
      error?: { message?: string };
      choices?: { message?: unknown }[];
    };
    if (!res.ok) {
      throw new Error(payload.error?.message || `openrouter_${res.status}`);
    }
    const raw = salvageJson(contentText(payload.choices?.[0]?.message)) as {
      onTopic?: unknown;
      message?: unknown;
      keepCardIds?: unknown;
    };
    const onTopic = raw.onTopic !== false;
    const message =
      typeof raw.message === "string" && raw.message.trim()
        ? raw.message.trim().slice(0, 400)
        : onTopic
          ? "Here are a few fixes you can apply."
          : offTopicRefusal();
    const keepCardIds =
      onTopic && Array.isArray(raw.keepCardIds)
        ? raw.keepCardIds.filter((id): id is string => typeof id === "string")
        : onTopic
          ? opts.cards.map((c) => c.id)
          : [];
    return { onTopic, message, keepCardIds, model };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
