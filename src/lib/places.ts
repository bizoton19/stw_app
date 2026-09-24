import { randomUUID } from "node:crypto";

export type PlacePrediction = {
  placeId: string;
  name: string;
  secondary: string;
  distanceMeters?: number | null;
  provider: "mapbox" | "apple";
  /** Present when the provider already resolved coordinates (e.g. MapKit). */
  lat?: number | null;
  lng?: number | null;
  formattedAddress?: string | null;
  category?: string | null;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  provider: "mapbox" | "apple";
};

const FOOD_POI =
  "restaurant,bar,cafe,coffee,bakery,pub,nightlife,food,fast_food,wine_bar,brewery";

function mapboxToken(): string | null {
  const t = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  return t || null;
}

export function placesConfigured(): boolean {
  return Boolean(mapboxToken());
}

/** Mapbox Search Box suggest — used for Android + web (and iOS Expo Go fallback). */
export async function mapboxAutocomplete(input: {
  q: string;
  lat?: number | null;
  lng?: number | null;
  session: string;
  limit?: number;
}): Promise<PlacePrediction[]> {
  const token = mapboxToken();
  if (!token) return [];

  const q = input.q.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    access_token: token,
    session_token: input.session || randomUUID(),
    limit: String(Math.min(input.limit ?? 8, 10)),
    types: "poi",
    poi_category: FOOD_POI,
    language: "en",
  });
  if (
    typeof input.lng === "number" &&
    typeof input.lat === "number" &&
    Number.isFinite(input.lng) &&
    Number.isFinite(input.lat)
  ) {
    params.set("proximity", `${input.lng},${input.lat}`);
  }

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error("mapbox_suggest_failed"), {
      code: "places_upstream",
      status: 502,
      detail: text.slice(0, 200),
    });
  }

  const data = (await res.json()) as {
    suggestions?: Array<{
      mapbox_id?: string;
      name?: string;
      place_formatted?: string;
      full_address?: string;
      feature_type?: string;
      distance?: number;
      poi_category?: string[];
    }>;
  };

  return (data.suggestions ?? [])
    .filter((s) => s.mapbox_id && s.name)
    .map((s) => ({
      placeId: s.mapbox_id as string,
      name: s.name as string,
      secondary: s.place_formatted || s.full_address || "",
      distanceMeters: typeof s.distance === "number" ? s.distance : null,
      provider: "mapbox" as const,
      category: s.poi_category?.[0] ?? null,
    }));
}

export async function mapboxDetails(input: {
  placeId: string;
  session: string;
}): Promise<PlaceDetails | null> {
  const token = mapboxToken();
  if (!token) return null;

  const params = new URLSearchParams({
    access_token: token,
    session_token: input.session || randomUUID(),
    language: "en",
  });

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(input.placeId)}?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error("mapbox_retrieve_failed"), {
      code: "places_upstream",
      status: 502,
      detail: text.slice(0, 200),
    });
  }

  const data = (await res.json()) as {
    features?: Array<{
      properties?: {
        mapbox_id?: string;
        name?: string;
        full_address?: string;
        place_formatted?: string;
        coordinates?: { latitude?: number; longitude?: number };
        poi_category?: string[];
      };
      geometry?: { coordinates?: [number, number] };
    }>;
  };

  const feature = data.features?.[0];
  const props = feature?.properties;
  if (!props?.name) return null;

  const lng =
    props.coordinates?.longitude ?? feature?.geometry?.coordinates?.[0] ?? null;
  const lat =
    props.coordinates?.latitude ?? feature?.geometry?.coordinates?.[1] ?? null;

  return {
    placeId: props.mapbox_id || input.placeId,
    name: props.name,
    formattedAddress: props.full_address || props.place_formatted || null,
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
    category: props.poi_category?.[0] ?? null,
    provider: "mapbox",
  };
}
