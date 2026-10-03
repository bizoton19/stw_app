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
  rating: number | null;
  userRatingCount: number | null;
  /** Proxied `/api/places/photo` URL. Never a Google URL that carries an API key. */
  photoUrl: string | null;
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
    rating: finite(place.rating),
    userRatingCount: finite(place.userRatingCount),
    photoUrl: safePhotoUrl(place.photoUrl),
    websiteUri: text(place.websiteUri),
    googleMapsUri: text(place.googleMapsUri),
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
