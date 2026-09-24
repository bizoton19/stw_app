import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findVenueDayConflict,
  isValidatedVenue,
  receiptDayKey,
  venueLocationKey,
} from "./venue-day";
import type { Receipt, ReceiptVenue } from "./types";

const placesVenue = (over: Partial<ReceiptVenue> = {}): ReceiptVenue => ({
  name: "Joe's Bar",
  placeId: "abc123",
  provider: "mapbox",
  formattedAddress: "1 Main St",
  lat: 40.7,
  lng: -74.0,
  category: "bar",
  source: "places",
  confirmedAt: new Date().toISOString(),
  ...over,
});

function receipt(over: Partial<Receipt>): Receipt {
  return {
    id: "r1",
    status: "open",
    restaurant: "Joe's Bar",
    venue: placesVenue(),
    receiptDate: "2026-09-24",
    items: [],
    fees: [],
    claims: [],
    createdAt: "2026-09-24T18:00:00.000Z",
    ...over,
  };
}

describe("venue-day", () => {
  it("requires a Places pin", () => {
    assert.equal(isValidatedVenue(null), false);
    assert.equal(isValidatedVenue({ ...placesVenue(), source: "typed", placeId: null }), false);
    assert.equal(isValidatedVenue(placesVenue()), true);
  });

  it("keys by placeId when present", () => {
    assert.equal(venueLocationKey(placesVenue()), "place:mapbox:abc123");
  });

  it("blocks a second publish for the same place + day", () => {
    const existing = receipt({ id: "old" });
    const hit = findVenueDayConflict(
      [existing],
      "new",
      placesVenue(),
      "Joe's Bar",
      "2026-09-24",
    );
    assert.equal(hit?.id, "old");
  });

  it("allows the same place on a different day", () => {
    const existing = receipt({ id: "old", receiptDate: "2026-09-23" });
    const hit = findVenueDayConflict(
      [existing],
      "new",
      placesVenue(),
      "Joe's Bar",
      "2026-09-24",
    );
    assert.equal(hit, null);
  });

  it("prefers receiptDate for the day key", () => {
    assert.equal(
      receiptDayKey({ receiptDate: "2026-01-02", createdAt: "2026-09-24T00:00:00.000Z" }),
      "2026-01-02",
    );
  });
});
