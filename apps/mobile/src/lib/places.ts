import { Platform } from "react-native";
import { api } from "./api";
import {
  nearbyQuery,
  parsePlaceDetail,
  placeDetailsQuery,
  placesFromNearbyResponse,
  type NearbyPlaceCard,
  type PlaceDetail,
} from "./nearby-places";
import type { ReceiptVenue } from "./types";

export type PlacePrediction = {
  placeId: string;
  name: string;
  secondary: string;
  distanceMeters?: number | null;
  provider: "mapbox" | "apple";
  lat?: number | null;
  lng?: number | null;
  formattedAddress?: string | null;
  category?: string | null;
};

type Coords = { lat: number; lng: number };

function newSession(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function mapkitSuggest(
  query: string,
  coords: Coords | null,
): Promise<PlacePrediction[]> {
  if (Platform.OS !== "ios") return [];
  try {
    const { isMapkitSearchAvailable, mapkitSuggest: nativeSuggest } = await import(
      "mapkit-search"
    );
    if (!isMapkitSearchAvailable()) return [];
    const rows = await nativeSuggest(query, coords);
    return rows.map((row) => ({
      placeId: row.placeId,
      name: row.name,
      secondary: row.secondary,
      provider: "apple" as const,
      lat: row.lat,
      lng: row.lng,
      formattedAddress: row.formattedAddress,
      category: row.category,
    }));
  } catch {
    return [];
  }
}

async function mapboxSuggest(
  query: string,
  coords: Coords | null,
  session: string,
): Promise<PlacePrediction[]> {
  const params = new URLSearchParams({ q: query, session });
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
  }
  const data = await api<{ predictions: PlacePrediction[]; configured?: boolean }>(
    `/api/places/autocomplete?${params}`,
  );
  return data.predictions ?? [];
}

/** iOS: MapKit when native module is present; else Mapbox. Android/web: Mapbox. */
export async function searchPlaces(
  query: string,
  coords: Coords | null,
  session: string,
): Promise<PlacePrediction[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (Platform.OS === "ios") {
    const apple = await mapkitSuggest(q, coords);
    if (apple.length > 0) return apple;
  }
  return mapboxSuggest(q, coords, session);
}

type BridgedPlace = {
  placeId?: string;
  name?: string;
  formattedAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  provider?: string;
  rating?: number | null;
  userRatingCount?: number | null;
  photoUrl?: string | null;
  websiteUri?: string | null;
  googleMapsUri?: string | null;
};

/**
 * Text Search by name + coordinates. The Mapbox/MapKit id is not a Google id
 * and is not sent. A miss or a missing server key keeps the original provider.
 */
async function bridgeToGooglePlace(venue: ReceiptVenue): Promise<ReceiptVenue> {
  if (
    typeof venue.lat !== "number" ||
    typeof venue.lng !== "number" ||
    !Number.isFinite(venue.lat) ||
    !Number.isFinite(venue.lng) ||
    !venue.name.trim()
  ) {
    return venue;
  }
  try {
    const params = new URLSearchParams({
      name: venue.name.trim(),
      lat: String(venue.lat),
      lng: String(venue.lng),
    });
    const data = await api<{ bridged?: boolean; place?: BridgedPlace | null }>(
      `/api/places/bridge?${params}`,
    );
    const place = data.place;
    if (!data.bridged || !place || place.provider !== "google" || !place.placeId) {
      return venue;
    }
    return {
      name: place.name || venue.name,
      placeId: place.placeId,
      provider: "google",
      formattedAddress: place.formattedAddress ?? venue.formattedAddress ?? null,
      lat: typeof place.lat === "number" ? place.lat : venue.lat,
      lng: typeof place.lng === "number" ? place.lng : venue.lng,
      category: place.category ?? venue.category ?? null,
      source: "places",
      confirmedAt: venue.confirmedAt,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      photoUrl: place.photoUrl ?? null,
      websiteUri: place.websiteUri ?? null,
      googleMapsUri: place.googleMapsUri ?? null,
    };
  } catch {
    return venue;
  }
}

/**
 * Nearby food and drink. 503 (no server key) and 502 (Google upstream) are an
 * empty list — the caller keeps the typeahead. Never throws.
 */
export async function fetchNearbyPlaces(coords: Coords): Promise<NearbyPlaceCard[]> {
  try {
    const data = await api<unknown>(nearbyQuery(coords.lat, coords.lng));
    return placesFromNearbyResponse(200, data);
  } catch {
    return [];
  }
}

export async function resolvePlaceDetails(
  prediction: PlacePrediction,
  session: string,
): Promise<ReceiptVenue> {
  const confirmedAt = new Date().toISOString();

  if (
    prediction.provider === "apple" &&
    typeof prediction.lat === "number" &&
    typeof prediction.lng === "number"
  ) {
    return bridgeToGooglePlace({
      name: prediction.name,
      placeId: prediction.placeId,
      provider: "apple",
      formattedAddress: prediction.formattedAddress ?? prediction.secondary ?? null,
      lat: prediction.lat,
      lng: prediction.lng,
      category: prediction.category ?? null,
      source: "places",
      confirmedAt,
    });
  }

  const data = await api<{
    place: {
      placeId: string;
      name: string;
      formattedAddress: string | null;
      lat: number | null;
      lng: number | null;
      category: string | null;
      provider: "mapbox" | "apple";
    };
  }>(
    `/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}&session=${encodeURIComponent(session)}`,
  );

  return bridgeToGooglePlace({
    name: data.place.name || prediction.name,
    placeId: data.place.placeId,
    provider: data.place.provider === "apple" ? "apple" : "mapbox",
    // Prefer Place Details full address (city, state, zip, country) when present.
    formattedAddress:
      data.place.formattedAddress ||
      prediction.secondary ||
      prediction.formattedAddress ||
      null,
    lat: data.place.lat,
    lng: data.place.lng,
    category: data.place.category,
    source: "places",
    confirmedAt,
  });
}

export async function resolveVenueFromName(
  name: string,
  coords: Coords | null,
): Promise<ReceiptVenue | null> {
  const q = name.trim();
  if (q.length < 2) return null;
  const session = newSession();

  const pick = async (query: string) => {
    const predictions = await searchPlaces(query, coords, session);
    if (!predictions.length) return null;
    const needle = query.toLowerCase();
    return (
      predictions.find((p) => p.name.toLowerCase() === needle) ||
      predictions.find(
        (p) =>
          p.name.toLowerCase().startsWith(needle) ||
          needle.startsWith(p.name.toLowerCase()),
      ) ||
      predictions[0]
    );
  };

  let best = await pick(q);
  if (!best && q.includes(" - ")) best = await pick(q.split(" - ")[0]!.trim());
  if (!best && q.includes(",")) best = await pick(q.split(",")[0]!.trim());
  if (!best) return null;

  const resolved = await resolvePlaceDetails(best, session);
  if (resolved.lat == null || resolved.lng == null) return null;
  return resolved;
}

/**
 * Place Details for the one place the user opened. 400 (including a Mapbox
 * id), 502, and 503 are null — Plan here still keeps the nearby card.
 */
export async function fetchPlaceDetail(placeId: string): Promise<PlaceDetail | null> {
  try {
    const data = await api<unknown>(placeDetailsQuery(placeId));
    return parsePlaceDetail(200, data);
  } catch {
    return null;
  }
}

export function typedVenue(name: string): ReceiptVenue {
  return {
    name: name.trim(),
    placeId: null,
    provider: null,
    formattedAddress: null,
    lat: null,
    lng: null,
    category: null,
    source: "typed",
    confirmedAt: new Date().toISOString(),
  };
}

export { newSession };
