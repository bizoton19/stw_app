import "server-only";

import type { ParseResult } from "./types";
import { salvageJsonObject, validateParse } from "./vision-stub";

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
- If the image is not a receipt or is unreadable, return restaurant as "", receiptDate as null, and empty items and fees arrays.`;

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

export async function parseReceiptVision(image: {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
}): Promise<ParseResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error("missing_openrouter_key");
  }
  const model = visionModel();
  const controller = new AbortController();
  /** Slightly under the outer Promise.race so AbortSignal fires first when possible. */
  const timer = setTimeout(() => controller.abort(), 38_000);
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
        max_tokens: 2048,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this receipt photo. Extract restaurant name, line items, and fees.",
              },
              { type: "image_url", image_url: { url: dataUrl(image) } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt_parse",
            strict: true,
            schema: RECEIPT_SCHEMA,
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
    try {
      return validateParse(JSON.parse(text));
    } catch {
      return validateParse(salvageJsonObject(text));
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error("vision_timeout"), { code: "timeout" });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
