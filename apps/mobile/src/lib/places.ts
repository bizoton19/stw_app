import { Platform } from "react-native";
import { api } from "./api";
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
    return {
      name: prediction.name,
      placeId: prediction.placeId,
      provider: "apple",
      formattedAddress: prediction.formattedAddress ?? prediction.secondary ?? null,
      lat: prediction.lat,
      lng: prediction.lng,
      category: prediction.category ?? null,
      source: "places",
      confirmedAt,
    };
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

  return {
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
  };
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
