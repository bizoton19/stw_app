import { SAMPLE_PARSE } from "./sample-tab";
import type { ParseResult } from "./types";

function delayMs(): number {
  const raw = process.env.PARSE_DELAY_MS;
  if (raw === undefined || raw === "") return 1400;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 1400;
}

/** Stub parser. Ignores image bytes and returns the reference bar tab. */
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

function wholeQty(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isFinite(n) || n < 0.5) {
    throw new Error("malformed_parse");
  }
  const qty = Math.round(n);
  if (Math.abs(n - qty) > 0.2 || qty < 1) {
    throw new Error("malformed_parse");
  }
  return qty;
}

function money(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw.replace(/[$,]/g, "").trim()) : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("malformed_parse");
  }
  return n;
}

export function validateParse(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("malformed_parse");
  }
  const obj = raw as Record<string, unknown>;
  const restaurant = typeof obj.restaurant === "string" ? obj.restaurant : "";
  const receiptDate = normalizeReceiptDate(obj.receiptDate);
  if (!Array.isArray(obj.items) || !Array.isArray(obj.fees)) {
    throw new Error("malformed_parse");
  }
  const items = obj.items.map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("malformed_parse");
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) throw new Error("malformed_parse");
    return { name, qty: wholeQty(row.qty ?? 1), total: money(row.total) };
  });
  const fees = obj.fees.map((fee) => {
    if (typeof fee !== "object" || fee === null) throw new Error("malformed_parse");
    const row = fee as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) throw new Error("malformed_parse");
    return { name, amount: money(row.amount) };
  });
  return normalizeParse({ restaurant, receiptDate, items, fees });
}

/** Accept YYYY-MM-DD (or null). Soft-parse common printed forms. */
export function normalizeReceiptDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    // Prefer US M/D/Y when ambiguous
    const month = a;
    const day = b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

const TOTAL_LINE =
  /^(sub(?:\s|-)*total|total|grand(?:\s|-)*total|amount(?:\s|-)*due|balance(?:\s|-)*due|change(?:\s+due)?|payment|cash|visa|mastercard|amex|discover)$/i;
const FEE_LINE =
  /\b(tax|vat|gst|hst|sales\s*tax|gratuity|tip|service(?:\s*charge)?|admin(?:istrative)?(?:\s*fee)?|delivery|surcharge)\b/i;

export function isTotalLine(name: string): boolean {
  return TOTAL_LINE.test(name.trim());
}

export function isFeeLine(name: string): boolean {
  return FEE_LINE.test(name.trim()) && !isTotalLine(name);
}

/** Drop Subtotal/Total rows; move tax/tip/admin out of items into fees. */
export function normalizeParse(parsed: ParseResult): ParseResult {
  const items: ParseResult["items"] = [];
  const fees: ParseResult["fees"] = [];
  for (const fee of parsed.fees) {
    if (isTotalLine(fee.name)) continue;
    fees.push(fee);
  }
  for (const item of parsed.items) {
    if (isTotalLine(item.name)) continue;
    if (isFeeLine(item.name)) {
      fees.push({ name: item.name, amount: item.total });
      continue;
    }
    items.push({ ...item, qty: Math.max(1, Math.round(item.qty)) });
  }
  return {
    restaurant: parsed.restaurant.trim(),
    receiptDate: parsed.receiptDate ?? null,
    items,
    fees,
  };
}
