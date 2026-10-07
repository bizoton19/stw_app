/** Host receipt line quantity. Claim steppers pass their own max. */
export const HOST_LINE_QTY_MIN = 1;
export const HOST_LINE_QTY_MAX = 99;

/**
 * Keep the printed unit price when quantity changes.
 * Matches the old items keystroke handler: unit = round(total / previous qty).
 */
export function rescaleLineTotal(
  totalCents: number,
  prevQty: number,
  nextQty: number,
): { qty: number; totalCents: number; totalInput: string } {
  const prev = Math.max(1, Math.floor(prevQty) || 1);
  const unitCents = Math.round(totalCents / prev);
  const total = unitCents * nextQty;
  return {
    qty: nextQty,
    totalCents: total,
    totalInput: (total / 100).toFixed(2),
  };
}
