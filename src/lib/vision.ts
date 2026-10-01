import "server-only";

import type { ParseResult } from "./types";
import {
  interpretClassifyPayload,
  salvageJsonObject,
  validateParse,
  type ReceiptClassifyResult,
} from "./vision-stub";

export type { ReceiptClassifyResult };
export { interpretClassifyPayload };

/** Default Google AI model id (not an OpenRouter slug). */
export const GEMINI_VISION_MODEL = "gemini-2.5-flash-lite";

const GEMINI_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** OpenAPI-style schema for Gemini `responseSchema` (no additionalProperties / union types). */
const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    restaurant: { type: "string" },
    receiptDate: {
      type: "string",
      nullable: true,
      description: "Date printed on the receipt as YYYY-MM-DD, or null if missing/unreadable",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: { type: "integer" },
          total: { type: "number" },
          kind: {
            type: "string",
            description: "food | drink | unknown if unclear",
            enum: ["food", "drink", "unknown"],
          },
        },
        required: ["name", "qty", "total", "kind"],
      },
    },
    fees: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
        },
        required: ["name", "amount"],
      },
    },
  },
  required: ["restaurant", "receiptDate", "items", "fees"],
} as const;

const SYSTEM_PROMPT = `You extract restaurant/bar receipts for a check-splitting app.

Return JSON only, matching the schema.
- restaurant: venue name on the check.
- receiptDate: the date printed on the receipt as YYYY-MM-DD. If only month/day (no year), assume the most recent past occurrence of that date. If unreadable or absent, null.
- items: orderable food and drink lines. name, whole-number quantity, line total (not unit price). If quantity is missing, use 1.
- kind: for each item, "drink" for beverages/alcohol/coffee/tea/juice/soda, "food" for edible dishes/sides/desserts, or "unknown" only if truly ambiguous.
- fees: tax, VAT, gratuity/tip/service, admin, delivery, surcharges only when they are ADDED on top of the item subtotal. If the printed total equals the item sum (VAT-inclusive prices), omit included tax from fees.
- Never put Subtotal, Total, Grand Total, Amount Due, Change, Cash, or card-tender lines in items or fees.
- Numbers only: no currency symbols, no thousands separators.
- If the image is unreadable, return restaurant as "", receiptDate as null, and empty items and fees arrays.`;

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    isReceipt: { type: "boolean" },
  },
  required: ["isReceipt"],
} as const;

const CLASSIFY_PROMPT = `You classify images for a restaurant check-splitting app.

Return JSON only, matching the schema.
isReceipt must be true only when the image clearly shows a restaurant, bar, cafe, or similar venue receipt, bill, itemized tab, or payment check (paper photo or digital screenshot of a check).
isReceipt must be false for menus, food/drink photos, people, landscapes, random documents, blank/black images, product packaging, or anything that is not a payment receipt/tab.`;

type VisionImage = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

function imageMime(image: { type: string }): string {
  return image.type && image.type.startsWith("image/") ? image.type : "image/jpeg";
}

function candidateText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") {
    return "";
  }
  const content = (candidates[0] as { content?: unknown }).content;
  if (!content || typeof content !== "object") return "";
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

export function visionModel(): string {
  return process.env.GEMINI_VISION_MODEL?.trim() || GEMINI_VISION_MODEL;
}

async function geminiVisionJson(opts: {
  image: VisionImage;
  system: string;
  userText: string;
  schema: object;
  maxTokens: number;
  abortMs: number;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("missing_gemini_key");
  }
  const model = visionModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.abortMs);
  try {
    const res = await fetch(`${GEMINI_GENERATE_URL}/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: opts.system }],
        },
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: imageMime(opts.image),
                  data: opts.image.bytes.toString("base64"),
                },
              },
              { text: opts.userText },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: opts.maxTokens,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      }),
    });
    const payload = (await res.json()) as {
      error?: { message?: string; status?: string };
    };
    if (!res.ok) {
      throw new Error(payload.error?.message || `gemini_${res.status}`);
    }
    const text = candidateText(payload);
    if (!text.trim()) {
      throw new Error("empty_model_response");
    }
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error("vision_timeout"), { code: "timeout" });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function classifyReceiptVision(image: VisionImage): Promise<ReceiptClassifyResult> {
  /** Slightly under the outer Promise.race so AbortSignal fires first when possible. */
  const text = await geminiVisionJson({
    image,
    system: CLASSIFY_PROMPT,
    userText: "Is this image a restaurant/bar receipt or tab? Answer with the JSON schema only.",
    schema: CLASSIFY_SCHEMA,
    maxTokens: 64,
    abortMs: 11_000,
  });
  return interpretClassifyPayload(text);
}

export async function parseReceiptVision(image: VisionImage): Promise<ParseResult> {
  /** Slightly under the outer Promise.race so AbortSignal fires first when possible. */
  const text = await geminiVisionJson({
    image,
    system: SYSTEM_PROMPT,
    userText: "Read this receipt photo. Extract restaurant name, line items, and fees.",
    schema: RECEIPT_SCHEMA,
    maxTokens: 2048,
    abortMs: 38_000,
  });
  try {
    return validateParse(JSON.parse(text));
  } catch {
    return validateParse(salvageJsonObject(text));
  }
}
