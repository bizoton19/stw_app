import "server-only";

/** Default agent model — same cheap Flash family as vision. */
export const OPENROUTER_AGENT_MODEL = "google/gemini-2.5-flash";

export function agentModel(): string {
  return process.env.OPENROUTER_AGENT_MODEL?.trim() || OPENROUTER_AGENT_MODEL;
}

export function agentMaxTokens(): number {
  const n = Number(process.env.AGENT_MAX_TOKENS ?? 512);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1024) : 512;
}

export function agentMaxToolCalls(): number {
  const n = Number(process.env.AGENT_MAX_TOOL_CALLS ?? 4);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 8) : 4;
}

export function agentMaxTurnsPerReceipt(): number {
  const n = Number(process.env.AGENT_MAX_TURNS_PER_RECEIPT ?? 5);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 20) : 5;
}

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
