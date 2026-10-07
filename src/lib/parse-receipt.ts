import type { ParseResult } from "./types";
import { parseReceiptStub } from "./vision-stub";

export type ParseReason =
  | "ok"
  | "no_key"
  | "no_image"
  | "failed"
  | "empty"
  | "timeout"
  | "not_receipt";
export type ParseSource = "vision" | "stub";
export type ParseMeta = { source: ParseSource; reason: ParseReason };

export type ReceiptImage = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Hard ceiling around the whole vision extract — fail fast if Gemini stalls. */
export const VISION_TIMEOUT_MS = 15_000;
/** Short gate before extract — fail-open on timeout so real receipts still parse. */
export const CLASSIFY_TIMEOUT_MS = 12_000;
const EMPTY_PARSE: ParseResult = { restaurant: "", receiptDate: null, items: [], fees: [] };

export function hasVisionKey(): boolean {
  const forced = process.env.VISION_PROVIDER?.trim().toLowerCase();
  if (forced === "gemini") return Boolean(process.env.GEMINI_API_KEY?.trim());
  if (forced === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  return Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
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

function logVisionClassify(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      event: "vision.classify",
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
  if (!hasVisionKey()) {
    logVisionParse({
      receiptId,
      source: "stub",
      reason: "no_key",
      ms: 0,
      imageBytes: image.bytes.length,
    });
    return { result: EMPTY_PARSE, parse: { source: "stub", reason: "no_key" } };
  }

  const { classifyReceiptVision, parseReceiptVision, visionModel, visionProviderId } =
    await import("./vision");
  const { shrinkReceiptForVision } = await import("./vision-image");
  const model = visionModel();
  const provider = visionProviderId();

  // Shrink only for the model — the original `image` is what the store persists.
  const shrunk = await shrinkReceiptForVision(image);
  const visionImage = shrunk.image;
  console.log(
    JSON.stringify({
      event: "vision.shrink",
      ts: new Date().toISOString(),
      receiptId,
      ms: shrunk.ms,
      imageBytes: image.bytes.length,
      visionBytes: visionImage.bytes.length,
      skipped: shrunk.skipped ?? null,
    }),
  );

  /**
   * Classify-before-parse was adding a full second round-trip (often 3–12s) on every
   * host upload. Hosts already chose “snap the check,” so skip the gate by default.
   * Set VISION_CLASSIFY=1 to restore the not-a-receipt screen.
   */
  const classifyEnabled = process.env.VISION_CLASSIFY?.trim() === "1";
  if (classifyEnabled) {
    const classifyStarted = Date.now();
    try {
      const classify = await Promise.race([
        classifyReceiptVision(visionImage),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(Object.assign(new Error("classify_timeout"), { code: "timeout" })),
            CLASSIFY_TIMEOUT_MS,
          );
        }),
      ]);
      logVisionClassify({
        receiptId,
        provider,
        model,
        isReceipt: classify.isReceipt,
        ms: Date.now() - classifyStarted,
        imageBytes: visionImage.bytes.length,
      });
      if (!classify.isReceipt) {
        return { result: EMPTY_PARSE, parse: { source: "vision", reason: "not_receipt" } };
      }
    } catch (err) {
      // Fail-open: a flaky classifier should not block a real tab from extracting.
      const message = err instanceof Error ? err.message : String(err);
      logVisionClassify({
        receiptId,
        provider,
        model,
        reason: "classify_failed",
        ms: Date.now() - classifyStarted,
        imageBytes: visionImage.bytes.length,
        detail: message.slice(0, 200),
      });
    }
  } else {
    logVisionClassify({
      receiptId,
      provider,
      model,
      reason: "skipped",
      ms: 0,
      imageBytes: visionImage.bytes.length,
      detail: "VISION_CLASSIFY off — host upload path",
    });
  }

  const started = Date.now();
  try {
    const result = await Promise.race([
      parseReceiptVision(visionImage),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error("vision_timeout"), { code: "timeout" })), VISION_TIMEOUT_MS);
      }),
    ]);
    const ms = Date.now() - started;
    if (result.items.length === 0) {
      logVisionParse({
        receiptId,
        provider,
        model,
        source: "vision",
        reason: "empty",
        ms,
        imageBytes: visionImage.bytes.length,
        itemCount: 0,
        feeCount: result.fees.length,
      });
      return { result, parse: { source: "vision", reason: "empty" } };
    }
    logVisionParse({
      receiptId,
      provider,
      model,
      source: "vision",
      reason: "ok",
      ms,
      imageBytes: visionImage.bytes.length,
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
      provider,
      model,
      source: "stub",
      reason,
      ms,
      imageBytes: visionImage.bytes.length,
      detail: message.slice(0, 200),
    });
    return { result: EMPTY_PARSE, parse: { source: "stub", reason } };
  }
}
