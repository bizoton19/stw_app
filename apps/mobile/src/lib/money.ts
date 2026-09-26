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

export function unitCentsArray(totalCents: number, qty: number): number[] {
  if (qty <= 0) return [];
  const base = Math.floor(totalCents / qty);
  const rem = totalCents % qty;
  return Array.from({ length: qty }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Typical unit price for display (floor of line / qty). */
export function unitPriceCents(totalCents: number, qty: number): number {
  return qty > 0 ? Math.floor(totalCents / qty) : 0;
}

/** Remaining dollar value for `left` unclaimed units on a line. */
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
