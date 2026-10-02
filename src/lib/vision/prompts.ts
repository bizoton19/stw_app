/** Shared prompts + schemas for receipt classify/parse (provider-agnostic). */

export const RECEIPT_SCHEMA = {
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

/** Stricter JSON Schema variant for OpenRouter `json_schema` / additionalProperties. */
export const RECEIPT_SCHEMA_STRICT = {
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

export const SYSTEM_PROMPT = `You extract restaurant/bar receipts for a check-splitting app.

Return JSON only, matching the schema.
- restaurant: venue name on the check.
- receiptDate: the date printed on the receipt as YYYY-MM-DD. If only month/day (no year), assume the most recent past occurrence of that date. If unreadable or absent, null.
- items: orderable food and drink lines. name, whole-number quantity, line total (not unit price). If quantity is missing, use 1.
- kind: for each item, "drink" for beverages/alcohol/coffee/tea/juice/soda, "food" for edible dishes/sides/desserts, or "unknown" only if truly ambiguous.
- fees: tax, VAT, gratuity/tip/service, admin, delivery, surcharges only when they are ADDED on top of the item subtotal. If the printed total equals the item sum (VAT-inclusive prices), omit included tax from fees.
- Never put Subtotal, Total, Grand Total, Amount Due, Change, Cash, or card-tender lines in items or fees.
- Numbers only: no currency symbols, no thousands separators.
- If the image is unreadable, return restaurant as "", receiptDate as null, and empty items and fees arrays.`;

export const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    isReceipt: { type: "boolean" },
  },
  required: ["isReceipt"],
} as const;

export const CLASSIFY_SCHEMA_STRICT = {
  type: "object",
  additionalProperties: false,
  properties: {
    isReceipt: { type: "boolean" },
  },
  required: ["isReceipt"],
} as const;

export const CLASSIFY_PROMPT = `You classify images for a restaurant check-splitting app.

Return JSON only, matching the schema.
isReceipt must be true only when the image clearly shows a restaurant, bar, cafe, or similar venue receipt, bill, itemized tab, or payment check (paper photo or digital screenshot of a check).
isReceipt must be false for menus, food/drink photos, people, landscapes, random documents, blank/black images, product packaging, or anything that is not a payment receipt/tab.`;
