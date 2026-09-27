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

export const OPENROUTER_VISION_MODEL = "google/gemini-2.5-flash";

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    restaurant: { type: "string" },
    receiptDate: {
      type: ["string", "null"],
      description: "Date printed on the receipt as YYYY-MM-DD, or null if missing/unreadable",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          qty: { type: "integer" },
          total: { type: "number" },
          kind: {
            type: "string",
            description: 'food | drink | unknown if unclear',
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
        additionalProperties: false,
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
  additionalProperties: false,
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

function dataUrl(image: { type: string; bytes: Buffer }): string {
  const mime = image.type && image.type.startsWith("image/") ? image.type : "image/jpeg";
  return `data:${mime};base64,${image.bytes.toString("base64")}`;
}

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

export function visionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL?.trim() || OPENROUTER_VISION_MODEL;
}

async function openRouterVisionJson(opts: {
  image: VisionImage;
  system: string;
  userText: string;
  schemaName: string;
  schema: object;
  maxTokens: number;
  abortMs: number;
}): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error("missing_openrouter_key");
  }
  const model = visionModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.abortMs);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://127.0.0.1:43147",
        "X-Title": "Split the Wine",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: opts.maxTokens,
        messages: [
          { role: "system", content: opts.system },
          {
            role: "user",
            content: [
              { type: "text", text: opts.userText },
              { type: "image_url", image_url: { url: dataUrl(opts.image) } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: opts.schemaName,
            strict: true,
            schema: opts.schema,
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
    const text = contentText(payload.choices?.[0]?.message);
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
  const text = await openRouterVisionJson({
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
  /** Slightly under the outer Promise.race so AbortSignal fires first when possible. */
  const text = await openRouterVisionJson({
    image,
    system: SYSTEM_PROMPT,
    userText: "Read this receipt photo. Extract restaurant name, line items, and fees.",
    schemaName: "receipt_parse",
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
