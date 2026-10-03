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
  /** Proxied `/api/places/photo` URL from nearby. Never a Google URL that carries an API key. */
  photoUrl: string | null;
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
    photoUrl: safePhotoUrl(place.photoUrl),
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

/** Photos already on the card. Does not call Google. */
export function placePhotos(card: {
  photoUrl?: string | null;
  photoUrls?: Array<string | null> | null;
}): string[] {
  const listed = Array.isArray(card.photoUrls)
    ? card.photoUrls.flatMap((url) => {
        const safe = safePhotoUrl(url);
        return safe ? [safe] : [];
      })
    : [];
  if (listed.length > 0) return listed.slice(0, 8);
  const one = safePhotoUrl(card.photoUrl);
  return one ? [one] : [];
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
  if (typeof count !== "number" || !Number.isFinite(count)) return score;
  return `${score} · ${Math.round(count).toLocaleString("en-US")}`;
}
