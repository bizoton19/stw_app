export function dollarsToCents(n: number): number {
  return Math.round(n * 100);
}

export function centsToLabel(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${rest.toString().padStart(2, "0")}`;
}

export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return dollarsToCents(n);
}

export function centsFromDollarsField(raw: string): number {
  return parseMoneyInput(raw) ?? 0;
}

/** Split totalCents across qty units with no leftover (largest remainder). */
export function unitCentsArray(totalCents: number, qty: number): number[] {
  if (qty <= 0) return [];
  const base = Math.floor(totalCents / qty);
  const rem = totalCents % qty;
  return Array.from({ length: qty }, (_, i) => base + (i < rem ? 1 : 0));
}

export function unitPriceCents(totalCents: number, qty: number): number {
  return qty > 0 ? Math.floor(totalCents / qty) : 0;
}

export function remainingLineCents(totalCents: number, qty: number, left: number): number {
  if (qty <= 0 || left <= 0) return 0;
  const capped = Math.min(left, qty);
  const units = unitCentsArray(totalCents, qty);
  const claimed = Math.max(0, qty - capped);
  return sumCents(units.slice(claimed));
}

export function sumCents(values: number[]): number {
  return values.reduce((s, n) => s + n, 0);
}
