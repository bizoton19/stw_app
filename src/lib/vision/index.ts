import "server-only";

import type { ParseResult } from "../types";
import {
  interpretClassifyPayload,
  salvageJsonObject,
  validateParse,
  type ReceiptClassifyResult,
} from "../vision-stub";
import { CLASSIFY_PROMPT, CLASSIFY_SCHEMA, RECEIPT_SCHEMA, SYSTEM_PROMPT } from "./prompts";
import { hasVisionProvider, resolveVisionProvider } from "./resolve";
import type { VisionImage } from "./types";

export type { ReceiptClassifyResult, VisionImage };
export { interpretClassifyPayload, hasVisionProvider, resolveVisionProvider };
export { GEMINI_VISION_MODEL } from "./providers/gemini";
export { OPENROUTER_VISION_MODEL } from "./providers/openrouter";

export function visionModel(): string {
  return resolveVisionProvider()?.model() ?? "none";
}

export function visionProviderId(): string {
  return resolveVisionProvider()?.id ?? "none";
}

export async function classifyReceiptVision(image: VisionImage): Promise<ReceiptClassifyResult> {
  const provider = resolveVisionProvider();
  if (!provider) throw new Error("missing_vision_key");

  /** Slightly under the outer Promise.race so AbortSignal fires first when possible. */
  const text = await provider.completeJson({
    image,
    system: CLASSIFY_PROMPT,
    userText: "Is this image a restaurant/bar receipt or tab? Answer with the JSON schema only.",
    schemaName: "receipt_classify",
    schema: CLASSIFY_SCHEMA,
    maxTokens: 64,
    abortMs: 11_000,
  });
  return interpretClassifyPayload(text);
}

export async function parseReceiptVision(image: VisionImage): Promise<ParseResult> {
  const provider = resolveVisionProvider();
  if (!provider) throw new Error("missing_vision_key");

  /** Slightly under the outer Promise.race so AbortSignal fires first when possible. */
  const text = await provider.completeJson({
    image,
    system: SYSTEM_PROMPT,
    userText: "Read this receipt photo. Extract restaurant name, line items, and fees.",
    schemaName: "receipt_parse",
    schema: RECEIPT_SCHEMA,
    maxTokens: 2048,
    abortMs: 14_000,
  });
  try {
    return validateParse(JSON.parse(text));
  } catch {
    return validateParse(salvageJsonObject(text));
  }
}
