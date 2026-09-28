import "server-only";

import {
  agentMaxTokens,
  agentModel,
  hasOpenRouterKey,
} from "@/lib/agent/config";
import type { AgentCard } from "@/lib/agent/heuristics";

const SYSTEM = `You help a restaurant-check host in Split the Wine.
You only phrase short copy and optionally pick which suggested cards to show.
Never invent money amounts. Never claim items for guests. Never send payments.
Return JSON only matching the schema.
- message: one or two short sentences for the bottom sheet.
- keepCardIds: subset of the provided card ids to show (empty = show none).
If the user asks something you cannot do with the cards, say so briefly and keep useful cards.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string" },
    keepCardIds: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["message", "keepCardIds"],
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

export type AgentLlmResult = {
  message: string;
  keepCardIds: string[];
  model: string;
};

/**
 * One cheap Flash call to phrase heuristics — not a free-form tool loop.
 */
export async function phraseAgentTurn(opts: {
  cards: AgentCard[];
  restaurant?: string;
  itemCount: number;
  feeCount: number;
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
    `Venue: ${opts.restaurant?.trim() || "(unknown)"}`,
    `Items: ${opts.itemCount}, fees: ${opts.feeCount}`,
    `Suggested cards:`,
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
        temperature: 0.2,
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
      message?: unknown;
      keepCardIds?: unknown;
    };
    const message =
      typeof raw.message === "string" && raw.message.trim()
        ? raw.message.trim().slice(0, 400)
        : "Here are a few fixes you can apply.";
    const keepCardIds = Array.isArray(raw.keepCardIds)
      ? raw.keepCardIds.filter((id): id is string => typeof id === "string")
      : opts.cards.map((c) => c.id);
    return { message, keepCardIds, model };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
