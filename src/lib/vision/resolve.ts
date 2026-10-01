import "server-only";

import { createGeminiProvider } from "./providers/gemini";
import { createOpenRouterProvider } from "./providers/openrouter";
import { selectVisionProviderId } from "./resolve-select";
import type { VisionProvider, VisionProviderId } from "./types";

export { AUTO_ORDER, parseVisionProviderId, selectVisionProviderId } from "./resolve-select";

/**
 * Pick the active vision backend.
 * - `VISION_PROVIDER=gemini|openrouter` forces that client (must have its key).
 * - Otherwise: first configured provider in AUTO_ORDER (gemini, then openrouter).
 */
export function resolveVisionProvider(): VisionProvider | null {
  const providers: Record<VisionProviderId, VisionProvider> = {
    gemini: createGeminiProvider(),
    openrouter: createOpenRouterProvider(),
  };
  const configured: Partial<Record<VisionProviderId, boolean>> = {
    gemini: providers.gemini.isConfigured(),
    openrouter: providers.openrouter.isConfigured(),
  };
  const chosen = selectVisionProviderId(process.env, configured);
  return chosen ? providers[chosen] : null;
}

export function hasVisionProvider(): boolean {
  return resolveVisionProvider() !== null;
}
