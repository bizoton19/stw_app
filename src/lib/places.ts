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
      category: s.poi_category?.join(" ") ?? null,
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

/** Resolve a free-text restaurant name to a Places venue (address + coords). */
export async function resolveVenueFromName(input: {
  name: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<import("./types").ReceiptVenue | null> {
  if (!placesConfigured()) return null;
  const q = input.name.trim();
  if (q.length < 2) return null;

  const session = randomUUID();
  const tryQuery = async (query: string) => {
    const predictions = await mapboxAutocomplete({
      q: query,
      lat: input.lat,
      lng: input.lng,
      session,
      limit: 8,
    });
    if (!predictions.length) return null;
    const needle = query.toLowerCase();
    const scored = [...predictions].sort((a, b) => {
      const score = (p: (typeof predictions)[0]) => {
        let s = 0;
        const n = p.name.toLowerCase();
        if (n === needle) s += 100;
        else if (n.startsWith(needle) || needle.startsWith(n)) s += 40;
        const cat = (p.category || "").toLowerCase();
        if (cat.includes("restaurant") || cat.includes("bar") || cat.includes("hotel")) s += 20;
        if (cat.includes("food")) s += 10;
        if (typeof p.distanceMeters === "number") {
          if (p.distanceMeters > 80_000) s -= 50;
          else s += Math.max(0, 25 - p.distanceMeters / 2000);
        }
        return s;
      };
      return score(b) - score(a);
    });
    const best = scored[0]!;
    // With proximity, refuse absurdly distant first hits (wrong continent).
    if (
      typeof input.lat === "number" &&
      typeof best.distanceMeters === "number" &&
      best.distanceMeters > 150_000 &&
      scored.every((p) => (p.distanceMeters ?? Infinity) > 80_000)
    ) {
      return null;
    }
    return mapboxDetails({ placeId: best.placeId, session });
  };

  let details = await tryQuery(q);
  // Receipt OCR often includes neighborhood / street — try shorter clauses.
  if (!details && q.includes(" - ")) {
    const parts = q.split(" - ").map((p) => p.trim()).filter(Boolean);
    details = await tryQuery(parts[0]!);
    if (!details && parts.length > 1) {
      details = await tryQuery(`${parts[0]} ${parts[1]}`);
    }
  }
  if (!details && q.includes(",")) {
    details = await tryQuery(q.split(",")[0]!.trim());
  }
  if (!details) {
    // Drop trailing location fluff: "Name DC Capitol …" → first 1–2 words
    const words = q.replace(/[-–,]/g, " ").split(/\s+/).filter(Boolean);
    if (words.length >= 2) details = await tryQuery(words.slice(0, 2).join(" "));
    if (!details && words.length >= 1) details = await tryQuery(words[0]!);
  }
  if (!details?.name) return null;
  if (details.lat == null || details.lng == null) return null;

  return {
    name: details.name,
    placeId: details.placeId,
    provider: "mapbox",
    formattedAddress: details.formattedAddress,
    lat: details.lat,
    lng: details.lng,
    category: details.category,
    source: "places",
    confirmedAt: new Date().toISOString(),
  };
}
