import type { ParseResult } from "./types";
import { parseReceiptStub } from "./vision-stub";

export type ParseReason = "ok" | "no_key" | "no_image" | "failed" | "empty" | "timeout";
export type ParseSource = "vision" | "stub";
export type ParseMeta = { source: ParseSource; reason: ParseReason };

export type ReceiptImage = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Hard ceiling around the whole vision attempt (client often dies ~60–300s otherwise). */
export const VISION_TIMEOUT_MS = 40_000;
const EMPTY_PARSE: ParseResult = { restaurant: "", receiptDate: null, items: [], fees: [] };

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function logVisionParse(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      event: "vision.parse",
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}

export async function parseReceiptImage(
  image?: ReceiptImage | null,
  opts?: { forceStub?: boolean; receiptId?: string },
): Promise<{ result: ParseResult; parse: ParseMeta }> {
  const receiptId = opts?.receiptId;
  if (opts?.forceStub) {
    logVisionParse({
      receiptId,
      source: "stub",
      reason: "no_image",
      ms: 0,
      detail: "forceStub",
    });
    return { result: await parseReceiptStub(image), parse: { source: "stub", reason: "no_image" } };
  }
  if (!image) {
    logVisionParse({ receiptId, source: "stub", reason: "no_image", ms: 0 });
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "no_image" } };
  }
  if (image.size > MAX_IMAGE_BYTES || image.bytes.length > MAX_IMAGE_BYTES) {
    logVisionParse({
      receiptId,
      source: "stub",
      reason: "failed",
      ms: 0,
      imageBytes: image.bytes.length,
      detail: "image_too_large",
    });
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "failed" } };
  }
  if (!hasOpenRouterKey()) {
    logVisionParse({
      receiptId,
      source: "stub",
      reason: "no_key",
      ms: 0,
      imageBytes: image.bytes.length,
    });
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "no_key" } };
  }

  const started = Date.now();
  const { parseReceiptVision, visionModel } = await import("./vision");
  const model = visionModel();
  try {
    const result = await Promise.race([
      parseReceiptVision(image),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error("vision_timeout"), { code: "timeout" })), VISION_TIMEOUT_MS);
      }),
    ]);
    const ms = Date.now() - started;
    if (result.items.length === 0) {
      logVisionParse({
        receiptId,
        model,
        source: "vision",
        reason: "empty",
        ms,
        imageBytes: image.bytes.length,
        itemCount: 0,
        feeCount: result.fees.length,
      });
      return { result, parse: { source: "vision", reason: "empty" } };
    }
    logVisionParse({
      receiptId,
      model,
      source: "vision",
      reason: "ok",
      ms,
      imageBytes: image.bytes.length,
      itemCount: result.items.length,
      feeCount: result.fees.length,
    });
    return { result, parse: { source: "vision", reason: "ok" } };
  } catch (err) {
    const ms = Date.now() - started;
    const code = (err as { code?: string }).code;
    const message = err instanceof Error ? err.message : String(err);
    const timedOut =
      code === "timeout" ||
      message === "vision_timeout" ||
      (err instanceof Error && err.name === "AbortError");
    const reason: ParseReason = timedOut ? "timeout" : "failed";
    logVisionParse({
      receiptId,
      model,
      source: "stub",
      reason,
      ms,
      imageBytes: image.bytes.length,
      detail: message.slice(0, 200),
    });
    return { result: EMPTY_PARSE, parse: { source: "stub", reason } };
  }
}
