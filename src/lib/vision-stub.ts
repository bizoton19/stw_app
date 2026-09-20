import { SAMPLE_PARSE } from "./sample-tab";
import type { ParseResult } from "./types";

function delayMs(): number {
  const raw = process.env.PARSE_DELAY_MS;
  if (raw === undefined || raw === "") return 1400;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 1400;
}

/**
 * Stub receipt parser. Ignores image bytes and returns the reference bar tab.
 * Swap this module for a real vision call when VISION_MODEL_API_KEY exists.
 */
export async function parseReceiptStub(
  _image?: {
    name: string;
    type: string;
    size: number;
  } | null,
): Promise<ParseResult> {
  void _image;
  await new Promise((r) => setTimeout(r, delayMs()));
  return structuredClone(SAMPLE_PARSE);
}

export function salvageJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("malformed_parse");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function validateParse(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("malformed_parse");
  }
  const obj = raw as Record<string, unknown>;
  const restaurant = typeof obj.restaurant === "string" ? obj.restaurant : "";
  if (!Array.isArray(obj.items) || !Array.isArray(obj.fees)) {
    throw new Error("malformed_parse");
  }
  const items = obj.items.map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("malformed_parse");
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const qty = Number(row.qty);
    const total = Number(row.total);
    if (!name || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(total) || total < 0) {
      throw new Error("malformed_parse");
    }
    return { name, qty, total };
  });
  const fees = obj.fees.map((fee) => {
    if (typeof fee !== "object" || fee === null) throw new Error("malformed_parse");
    const row = fee as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const amount = Number(row.amount);
    if (!name || !Number.isFinite(amount) || amount < 0) {
      throw new Error("malformed_parse");
    }
    return { name, amount };
  });
  return { restaurant, items, fees };
}
