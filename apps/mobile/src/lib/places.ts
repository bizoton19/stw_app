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
    // Prefer the autocomplete subtitle the host saw in the list.
    formattedAddress:
      prediction.secondary ||
      data.place.formattedAddress ||
      prediction.formattedAddress ||
      null,
    lat: data.place.lat,
    lng: data.place.lng,
    category: data.place.category,
    source: "places",
    confirmedAt,
  };
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
