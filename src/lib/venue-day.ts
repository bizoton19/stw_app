import type { Receipt, ReceiptVenue } from "./types";

/** Calendar day for duplicate checks — prefer the printed receipt date. */
export function receiptDayKey(
  receipt: Pick<Receipt, "receiptDate" | "createdAt"> | { receiptDate?: string | null; createdAt?: string },
): string {
  if (receipt.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receipt.receiptDate)) {
    return receipt.receiptDate;
  }
  const created = receipt.createdAt ? new Date(receipt.createdAt) : new Date();
  if (Number.isNaN(created.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return created.toISOString().slice(0, 10);
}

/** True when the host confirmed a Places pin (not free-typed). */
export function isValidatedVenue(venue: ReceiptVenue | null | undefined): boolean {
  if (!venue || venue.source !== "places") return false;
  if (venue.placeId && venue.placeId.trim()) return true;
  return (
    typeof venue.lat === "number" &&
    typeof venue.lng === "number" &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lng)
  );
}

/**
 * Stable location key for “same place” — prefer Places id, then rounded coords + name.
 */
export function venueLocationKey(
  venue: ReceiptVenue | null | undefined,
  restaurant?: string | null,
): string | null {
  if (venue?.placeId?.trim()) {
    return `place:${venue.provider ?? "any"}:${venue.placeId.trim()}`;
  }
  if (
    venue &&
    typeof venue.lat === "number" &&
    typeof venue.lng === "number" &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lng)
  ) {
    const lat = venue.lat.toFixed(4);
    const lng = venue.lng.toFixed(4);
    const name = (venue.name || restaurant || "").trim().toLowerCase();
    return `geo:${lat},${lng}:${name}`;
  }
  return null;
}

/** Another published tab already covers this Places pin on this calendar day. */
export function findVenueDayConflict<T extends Receipt>(
  candidates: T[],
  currentId: string,
  venue: ReceiptVenue | null | undefined,
  restaurant: string,
  receiptDate: string | null | undefined,
): T | null {
  if (!isValidatedVenue(venue)) return null;
  const key = venueLocationKey(venue, restaurant);
  if (!key) return null;
  const day = receiptDayKey({
    receiptDate: receiptDate ?? null,
    createdAt: new Date().toISOString(),
  });
  for (const row of candidates) {
    if (row.id === currentId) continue;
    if (row.status === "draft") continue;
    const otherKey = venueLocationKey(row.venue, row.restaurant);
    if (!otherKey || otherKey !== key) continue;
    if (receiptDayKey(row) === day) return row;
  }
  return null;
}
