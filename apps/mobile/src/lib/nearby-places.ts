/**
 * Nearby place cards for the outing and restaurant steps.
 *
 * Duplicated for Metro: `src/lib/nearby-place-card.ts` and
 * `apps/mobile/src/lib/nearby-places.ts` must stay byte-identical.
 * `src/lib/nearby-place-card.test.ts` checks that.
 * The Google key stays on the server. This module never reads one.
 */

export type NearbyPlaceCard = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  provider: "google";
  /**
   * Not part of nearby. Stay null until Place Details for this one place.
   * Plan here copies them only after that call.
   */
  rating: number | null;
  userRatingCount: number | null;
  /** First proxied `/api/places/photo` URL, or null. Same as `photoUrls[0]`. */
  photoUrl: string | null;
  /** At most two proxied photo URLs from nearby. Never a Google URL with an API key. */
  photoUrls: string[];
  websiteUri: string | null;
  googleMapsUri: string | null;
};

/** Place Details for one picked Google place. Photos stay on the nearby card. */
export type PlaceDetail = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
};

/** Cards show only while the typeahead query is empty or shorter than 2 characters. */
export function shouldShowNearbyCards(query: string): boolean {
  return query.trim().length < 2;
}

/** Lat and lng only. A place id is not part of nearby search. */
export function nearbyQuery(lat: number, lng: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  return `/api/places/nearby?${params}`;
}

/** One Google place id. The server rejects a Mapbox id. No API key. */
export function placeDetailsQuery(placeId: string): string {
  return `/api/places/google?placeId=${encodeURIComponent(placeId)}`;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Drop photo URLs that look like they carry an API key. */
export function safePhotoUrl(value: unknown): string | null {
  const url = text(value);
  if (!url) return null;
  if (/^\s*javascript:/i.test(url)) return null;
  if (/[?&#](key|x-goog-api-key)=/i.test(url)) return null;
  return url;
}

export function parseNearbyPlaceCard(row: unknown): NearbyPlaceCard | null {
  if (!row || typeof row !== "object") return null;
  const place = row as Record<string, unknown>;
  const placeId = text(place.placeId);
  const name = text(place.name);
  if (!placeId || !name) return null;
  if (place.provider !== "google") return null;
  const lat = finite(place.lat);
  const lng = finite(place.lng);
  if (lat == null || lng == null) return null;
  const photoUrls = placePhotos({
    photoUrl: text(place.photoUrl),
    photoUrls: Array.isArray(place.photoUrls) ? place.photoUrls : null,
  });
  return {
    placeId,
    name,
    formattedAddress: text(place.formattedAddress),
    lat,
    lng,
    category: text(place.category),
    provider: "google",
    rating: null,
    userRatingCount: null,
    photoUrl: photoUrls[0] ?? null,
    photoUrls,
    websiteUri: null,
    googleMapsUri: text(place.googleMapsUri),
  };
}

export function parsePlaceDetail(status: number, body: unknown): PlaceDetail | null {
  if (status !== 200 || !body || typeof body !== "object") return null;
  const row = (body as { place?: unknown }).place;
  if (!row || typeof row !== "object") return null;
  const place = row as Record<string, unknown>;
  const placeId = text(place.placeId);
  const name = text(place.name);
  if (!placeId || !name) return null;
  return {
    placeId,
    name,
    formattedAddress: text(place.formattedAddress),
    lat: finite(place.lat),
    lng: finite(place.lng),
    category: text(place.category),
    rating: finite(place.rating),
    userRatingCount: finite(place.userRatingCount),
    websiteUri: text(place.websiteUri),
    googleMapsUri: text(place.googleMapsUri),
  };
}

export async function readPlaceDetail(res: {
  status: number;
  json: () => Promise<unknown>;
}): Promise<PlaceDetail | null> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return parsePlaceDetail(res.status, body);
}

/** Rating, review count, and website come only from Place Details. */
export function mergePlaceDetail(card: NearbyPlaceCard, detail: PlaceDetail | null): NearbyPlaceCard {
  const base: NearbyPlaceCard = {
    ...card,
    rating: null,
    userRatingCount: null,
    websiteUri: null,
  };
  if (!detail || detail.placeId !== card.placeId) return base;
  return {
    ...base,
    name: detail.name || card.name,
    formattedAddress: detail.formattedAddress ?? card.formattedAddress,
    lat: detail.lat ?? card.lat,
    lng: detail.lng ?? card.lng,
    category: detail.category ?? card.category,
    rating: detail.rating,
    userRatingCount: detail.userRatingCount,
    websiteUri: detail.websiteUri,
    googleMapsUri: detail.googleMapsUri ?? card.googleMapsUri,
    photoUrl: card.photoUrl,
    photoUrls: card.photoUrls,
  };
}

/**
 * Anything other than HTTP 200 is an empty nearby list. That includes 503
 * (`google_places_not_configured`) and 502 (`places_upstream`). The place
 * step keeps working; typeahead is a separate request.
 */
export function placesFromNearbyResponse(status: number, body: unknown): NearbyPlaceCard[] {
  if (status !== 200 || !body || typeof body !== "object") return [];
  const places = (body as { places?: unknown }).places;
  if (!Array.isArray(places)) return [];
  const out: NearbyPlaceCard[] = [];
  for (const row of places) {
    const card = parseNearbyPlaceCard(row);
    if (card) out.push(card);
    if (out.length === 7) break;
  }
  return out;
}

export async function readNearbyPlaces(res: {
  status: number;
  json: () => Promise<unknown>;
}): Promise<NearbyPlaceCard[]> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return placesFromNearbyResponse(res.status, body);
}

export function venueFromNearbyCard(card: NearbyPlaceCard, confirmedAt: string) {
  return {
    name: card.name,
    placeId: card.placeId,
    provider: "google" as const,
    formattedAddress: card.formattedAddress,
    lat: card.lat,
    lng: card.lng,
    category: card.category,
    source: "places" as const,
    confirmedAt,
    rating: card.rating,
    userRatingCount: card.userRatingCount,
    photoUrl: card.photoUrl,
    websiteUri: card.websiteUri,
    googleMapsUri: card.googleMapsUri,
  };
}

const LOOPBACK_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "localhost"]);

function apiBase(apiOrigin: string | null | undefined): URL | null {
  const origin = (apiOrigin ?? "").trim().replace(/\/$/, "");
  if (!origin) return null;
  try {
    return new URL(origin.includes("://") ? origin : `http://${origin}`);
  } catch {
    return null;
  }
}

/**
 * Photo URLs the phone can load. A relative `/api/places/photo` path is
 * resolved against the API origin. Absolute `0.0.0.0`, `127.0.0.1`, and
 * `localhost` hosts are rewritten onto that same origin (path and query
 * kept) so a dev bind address still works if the server sends one.
 * Does not call Google.
 */
export function photoUrlForClient(
  url: string | null | undefined,
  apiOrigin: string | null | undefined,
): string | null {
  const safe = safePhotoUrl(url);
  if (!safe) return null;
  const base = apiBase(apiOrigin);
  if (safe.startsWith("/") && !safe.startsWith("//")) {
    if (!base) return safe;
    return new URL(safe, base).toString();
  }
  let parsed: URL;
  try {
    parsed = new URL(safe);
  } catch {
    return safe;
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) return safe;
  if (!base) return safe;
  parsed.protocol = base.protocol;
  parsed.host = base.host;
  return parsed.toString();
}

/** Server static map. No Mapbox token. w=600, h=220, z=15. */
export function staticMapPath(lat: number, lng: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    w: "600",
    h: "220",
    z: "15",
  });
  return `/api/places/static-map?${params}`;
}

/**
 * Same API origin as nearby photos. A relative path stays relative when no
 * origin is passed (the web page). Loopback hosts are rewritten.
 */
export function staticMapForClient(
  lat: number,
  lng: number,
  apiOrigin: string | null | undefined,
): string {
  const path = staticMapPath(lat, lng);
  return photoUrlForClient(path, apiOrigin) ?? path;
}

/** At most two photos already on the nearby card. Does not call Google. */
export function placePhotos(
  card: {
    photoUrl?: string | null;
    photoUrls?: Array<string | null> | null;
  },
  apiOrigin?: string | null,
): string[] {
  const listed = Array.isArray(card.photoUrls)
    ? card.photoUrls.flatMap((url) => {
        const safe = safePhotoUrl(url);
        return safe ? [safe] : [];
      })
    : [];
  const urls = listed.length > 0 ? listed.slice(0, 2) : [];
  const chosen = urls.length > 0 ? urls : (() => {
    const one = safePhotoUrl(card.photoUrl);
    return one ? [one] : [];
  })();
  return chosen.flatMap((url) => {
    const next = photoUrlForClient(url, apiOrigin);
    return next ? [next] : [];
  });
}

export function formatPlaceCategory(category: string | null | undefined): string | null {
  if (typeof category !== "string") return null;
  const words = category.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function httpHref(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function formatPlaceRating(
  rating: number | null | undefined,
  count: number | null | undefined,
): string | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const score = rating.toFixed(1);
  if (typeof count !== "number" || !Number.isFinite(count)) return `Google rating ${score}`;
  const n = Math.round(count);
  const reviews = n === 1 ? "review" : "reviews";
  return `Google rating ${score} · ${n.toLocaleString("en-US")} ${reviews}`;
}
