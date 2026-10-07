import type { VisionProviderId } from "./types";

/** Preferred order when `VISION_PROVIDER` is unset. */
export const AUTO_ORDER: VisionProviderId[] = ["gemini", "openrouter"];

export function parseVisionProviderId(raw: string | undefined): VisionProviderId | null {
  const id = raw?.trim().toLowerCase();
  if (id === "gemini" || id === "openrouter") return id;
  return null;
}

/**
 * Pure selection: given which providers are configured, pick one.
 * - Forced `VISION_PROVIDER` wins if that id is configured.
 * - Else first configured id in AUTO_ORDER.
 */
export function selectVisionProviderId(
  env: NodeJS.ProcessEnv,
  configured: Partial<Record<VisionProviderId, boolean>>,
): VisionProviderId | null {
  const forced = parseVisionProviderId(env.VISION_PROVIDER);
  if (forced) return configured[forced] ? forced : null;
  for (const id of AUTO_ORDER) {
    if (configured[id]) return id;
  }
  return null;
}
