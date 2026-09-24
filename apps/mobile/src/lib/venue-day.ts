import type { ReceiptVenue } from "./types";

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
  const name = (venue?.name || restaurant || "").trim().toLowerCase();
  return name.length >= 2 ? `name:${name}` : null;
}

export function receiptDayKey(receiptDate: string | null | undefined, createdAt?: string): string {
  if (receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) return receiptDate;
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}
