import type { ParseResult } from "./types";
import { parseReceiptStub } from "./vision-stub";

export type ParseReason = "ok" | "no_key" | "no_image" | "failed" | "empty";
export type ParseSource = "vision" | "stub";
export type ParseMeta = { source: ParseSource; reason: ParseReason };

export type ReceiptImage = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EMPTY_PARSE: ParseResult = { restaurant: "", items: [], fees: [] };

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function parseReceiptImage(
  image?: ReceiptImage | null,
  opts?: { forceStub?: boolean },
): Promise<{ result: ParseResult; parse: ParseMeta }> {
  if (opts?.forceStub) {
    return { result: await parseReceiptStub(image), parse: { source: "stub", reason: "no_image" } };
  }
  if (!image) {
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "no_image" } };
  }
  if (image.size > MAX_IMAGE_BYTES || image.bytes.length > MAX_IMAGE_BYTES) {
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "failed" } };
  }
  if (!hasOpenRouterKey()) {
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "no_key" } };
  }
  try {
    const { parseReceiptVision } = await import("./vision");
    const result = await parseReceiptVision(image);
    if (result.items.length === 0) {
      return { result, parse: { source: "vision", reason: "empty" } };
    }
    return { result, parse: { source: "vision", reason: "ok" } };
  } catch {
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "failed" } };
  }
}
