/**
 * Server-only Google Places API (New) client.
 *
 * `GOOGLE_PLACES_API_KEY` is read here and sent only as the `X-Goog-Api-Key`
 * header. Do not import this module from a Client Component — Next can inline
 * `process.env.*` into the browser bundle. Mobile and web call the routes.
 *
 * Nearby uses `places:searchNearby` (top 7, popularity, primary food/drink
 * types, in-process cache ~8 min by geohash). Results with no coordinates
 * or coordinates outside the requested radius are dropped.
 * Photos are proxied. The typeahead bridge uses Text Search (`places:searchText`)
 * with the place **name** and **lat/lng** — the Find Place replacement. It never
 * calls Place Details and never forwards a Mapbox or MapKit id.
 *
 * Without a non-empty key every function throws `google_places_not_configured`
 * before `fetch`.
 */

const PLACES_BASE = "https://places.googleapis.com/v1";

export const NEARBY_LIMIT = 7;
export const NEARBY_CACHE_TTL_MS = 8 * 60 * 1000;
export const NEARBY_GEOHASH_PRECISION = 6;
export const PHOTO_MAX_WIDTH_PX = 400;
export const DEFAULT_NEARBY_RADIUS_M = 1500;

const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 50_000;
const BRIDGE_BIAS_RADIUS_M = 500;
const BRIDGE_MAX_DISTANCE_M = 1_500;
const BRIDGE_EXACT_MAX_DISTANCE_M = 5_000;
const MAX_PHOTO_BYTES = 5_000_000;
const MAX_NAME_LENGTH = 200;

/**
 * General Table A primary types. Nearby Search still returns more specific
 * primary types such as `italian_restaurant` when `restaurant` is included.
 */
const NEARBY_PRIMARY_TYPES = ["restaurant", "bar", "cafe", "bakery", "coffee_shop"];

const PLACE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.photos",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.primaryType",
].join(",");

const PHOTO_NAME =
  /^places\/[A-Za-z0-9._~-]+\/photos\/[A-Za-z0-9._~-]+$/;

const GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz";

export type GooglePlaceCard = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  provider: "google";
  rating: number | null;
  userRatingCount: number | null;
  /** Proxied `/api/places/photo` URL. Never a Google URL that carries the API key. */
  photoUrl: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
};

export type NearbySearchResult = {
  places: GooglePlaceCard[];
  provider: "google";
  limit: number;
  cached: boolean;
};

type NormalizedPlace = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  rating: number | null;
  userRatingCount: number | null;
  photoName: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
};

type CacheEntry = {
  expiresAt: number;
  places: NormalizedPlace[];
};

const nearbyCache = new Map<string, CacheEntry>();
let clock = () => Date.now();

export function clearNearbyCache(): void {
  nearbyCache.clear();
}

/** @internal Tests advance the nearby TTL without waiting. */
export function setGooglePlacesClockForTests(fn: (() => number) | null): void {
  clock = fn ?? (() => Date.now());
}

export function googlePlacesConfigured(): boolean {
  return readGooglePlacesKey() != null;
}

export function geohash(lat: number, lng: number, precision = NEARBY_GEOHASH_PRECISION): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) + 1;
        lngMin = mid;
      } else {
        ch <<= 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) + 1;
        latMin = mid;
      } else {
        ch <<= 1;
        latMax = mid;
      }
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      hash += GEOHASH_ALPHABET[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function proxiedPhotoPath(photoName: string, maxWidthPx = PHOTO_MAX_WIDTH_PX): string {
  const width = clampPhotoWidth(maxWidthPx);
  return `/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=${width}`;
}

export function clampPhotoWidth(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return PHOTO_MAX_WIDTH_PX;
  return Math.min(PHOTO_MAX_WIDTH_PX, Math.max(1, Math.round(value)));
}

function readGooglePlacesKey(): string | null {
  const raw = process.env.GOOGLE_PLACES_API_KEY;
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  return key ? key : null;
}

function fail(code: "google_places_not_configured" | "invalid" | "places_upstream", message: string): never {
  throw Object.assign(new Error(message), { code });
}

function requireGooglePlacesKey(): string {
  const key = readGooglePlacesKey();
  if (!key) {
    fail(
      "google_places_not_configured",
      "GOOGLE_PLACES_API_KEY is not set. Set a Places API (New) key on the server. Google is not called until then.",
    );
  }
  return key;
}

function assertCoords(lat: number, lng: number): { lat: number; lng: number } {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    fail("invalid", "lat and lng must be finite coordinates.");
  }
  return { lat, lng };
}

export function parseLatLng(
  latRaw: string | null,
  lngRaw: string | null,
): { lat: number; lng: number } {
  if (latRaw == null || latRaw.trim() === "" || lngRaw == null || lngRaw.trim() === "") {
    fail("invalid", "lat and lng are required.");
  }
  return assertCoords(Number(latRaw), Number(lngRaw));
}

function clampRadius(radius: number | undefined): number {
  if (radius == null || !Number.isFinite(radius)) return DEFAULT_NEARBY_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(radius)));
}

export function assertPhotoResourceName(name: string): string {
  const trimmed = name.trim();
  if (!PHOTO_NAME.test(trimmed) || trimmed.split("/").includes("..")) {
    fail("invalid", "Photo name must be a Places resource like places/{id}/photos/{ref}.");
  }
  return trimmed;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePlace(row: unknown): NormalizedPlace | null {
  if (!row || typeof row !== "object") return null;
  const place = row as {
    id?: unknown;
    displayName?: { text?: unknown };
    formattedAddress?: unknown;
    location?: { latitude?: unknown; longitude?: unknown };
    rating?: unknown;
    userRatingCount?: unknown;
    photos?: Array<{ name?: unknown }>;
    websiteUri?: unknown;
    googleMapsUri?: unknown;
    primaryType?: unknown;
  };
  const rawId = typeof place.id === "string" ? place.id.trim() : "";
  const placeId = rawId.replace(/^places\//, "");
  const name = typeof place.displayName?.text === "string" ? place.displayName.text.trim() : "";
  if (!placeId || !name) return null;
  const photoNameRaw = place.photos?.find((p) => typeof p?.name === "string")?.name;
  const photoName =
    typeof photoNameRaw === "string" && PHOTO_NAME.test(photoNameRaw.trim())
      ? photoNameRaw.trim()
      : null;
  const lat = finiteNumber(place.location?.latitude);
  const lng = finiteNumber(place.location?.longitude);
  const rating = finiteNumber(place.rating);
  const userRatingCount = finiteNumber(place.userRatingCount);
  return {
    placeId,
    name,
    formattedAddress: typeof place.formattedAddress === "string" ? place.formattedAddress : null,
    lat,
    lng,
    category: typeof place.primaryType === "string" ? place.primaryType : null,
    rating,
    userRatingCount: userRatingCount == null ? null : Math.max(0, Math.round(userRatingCount)),
    photoName,
    websiteUri: httpUrl(place.websiteUri),
    googleMapsUri: httpUrl(place.googleMapsUri),
  };
}

function readPlaces(data: unknown): NormalizedPlace[] {
  const places = (data as { places?: unknown } | null)?.places;
  if (!Array.isArray(places)) return [];
  const out: NormalizedPlace[] = [];
  for (const row of places) {
    const parsed = normalizePlace(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

function toCard(place: NormalizedPlace, origin: string): GooglePlaceCard {
  const path = place.photoName ? proxiedPhotoPath(place.photoName) : null;
  const base = origin.replace(/\/$/, "");
  return {
    placeId: place.placeId,
    name: place.name,
    formattedAddress: place.formattedAddress,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
    provider: "google",
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    photoUrl: path ? (base ? `${base}${path}` : path) : null,
    websiteUri: place.websiteUri,
    googleMapsUri: place.googleMapsUri,
  };
}

function placeInsideNearbyRadius(
  place: NormalizedPlace,
  lat: number,
  lng: number,
  radius: number,
): boolean {
  if (place.lat == null || place.lng == null) return false;
  return distanceMeters(lat, lng, place.lat, place.lng) <= radius;
}

function nearbyCacheKey(lat: number, lng: number, radius: number): string {
  const bucket = Math.round(radius / 100) * 100;
  return `${geohash(lat, lng, NEARBY_GEOHASH_PRECISION)}:${bucket}`;
}

function readNearbyCache(key: string): NormalizedPlace[] | null {
  const hit = nearbyCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= clock()) {
    nearbyCache.delete(key);
    return null;
  }
  return hit.places;
}

function writeNearbyCache(key: string, places: NormalizedPlace[]): void {
  if (nearbyCache.size > 400) {
    const oldest = nearbyCache.keys().next().value;
    if (oldest) nearbyCache.delete(oldest);
  }
  nearbyCache.set(key, { expiresAt: clock() + NEARBY_CACHE_TTL_MS, places });
}

async function googlePost(methodPath: "places:searchNearby" | "places:searchText", body: unknown, key: string): Promise<unknown> {
  const res = await fetch(`${PLACES_BASE}/${methodPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": PLACE_FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    fail("places_upstream", `Google Places request failed (${res.status}).`);
  }
  return res.json();
}

export async function searchNearby(input: {
  lat: number;
  lng: number;
  radius?: number;
  origin?: string;
}): Promise<NearbySearchResult> {
  const coords = assertCoords(input.lat, input.lng);
  const radius = clampRadius(input.radius);
  const key = requireGooglePlacesKey();
  const cacheKey = nearbyCacheKey(coords.lat, coords.lng, radius);
  const cached = readNearbyCache(cacheKey);
  if (cached) {
    return {
      places: cached.slice(0, NEARBY_LIMIT).map((place) => toCard(place, input.origin ?? "")),
      provider: "google",
      limit: NEARBY_LIMIT,
      cached: true,
    };
  }

  const data = await googlePost(
    "places:searchNearby",
    {
      includedPrimaryTypes: NEARBY_PRIMARY_TYPES,
      maxResultCount: NEARBY_LIMIT,
      rankPreference: "POPULARITY",
      languageCode: "en",
      locationRestriction: {
        circle: {
          center: { latitude: coords.lat, longitude: coords.lng },
          radius,
        },
      },
    },
    key,
  );
  const places = readPlaces(data)
    .filter((place) => placeInsideNearbyRadius(place, coords.lat, coords.lng, radius))
    .slice(0, NEARBY_LIMIT);
  writeNearbyCache(cacheKey, places);
  return {
    places: places.map((place) => toCard(place, input.origin ?? "")),
    provider: "google",
    limit: NEARBY_LIMIT,
    cached: false,
  };
}

function normalizePlaceName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function nameScore(query: string, candidate: string): number {
  const a = normalizePlaceName(query);
  const b = normalizePlaceName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.startsWith(a) || a.startsWith(b)) return 80;
  const tokens = a.split(" ");
  const candidateTokens = new Set(b.split(" "));
  if (tokens.length > 0 && tokens.every((token) => candidateTokens.has(token))) return 60;
  return 0;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pickBridgeMatch(
  query: string,
  lat: number,
  lng: number,
  places: NormalizedPlace[],
): NormalizedPlace | null {
  let best: { place: NormalizedPlace; score: number; distance: number } | null = null;
  for (const place of places) {
    const score = nameScore(query, place.name);
    if (score <= 0 || place.lat == null || place.lng == null) continue;
    const distance = distanceMeters(lat, lng, place.lat, place.lng);
    const allowed = score >= 100 ? BRIDGE_EXACT_MAX_DISTANCE_M : BRIDGE_MAX_DISTANCE_M;
    if (distance > allowed) continue;
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { place, score, distance };
    }
  }
  return best?.place ?? null;
}

/**
 * Resolve a typeahead selection to a Google place id.
 * Uses Text Search by name + coordinates. `placeId` is intentionally not a
 * parameter — Mapbox and MapKit ids must not be sent to Place Details.
 * Returns null when Google has no confident match. Throws when the key is missing.
 */
export async function bridgePlaceToGoogle(input: {
  name: string;
  lat: number;
  lng: number;
  origin?: string;
}): Promise<GooglePlaceCard | null> {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME_LENGTH) {
    fail("invalid", "name is required.");
  }
  const coords = assertCoords(input.lat, input.lng);
  const key = requireGooglePlacesKey();
  const data = await googlePost(
    "places:searchText",
    {
      textQuery: name,
      maxResultCount: 5,
      rankPreference: "DISTANCE",
      languageCode: "en",
      locationBias: {
        circle: {
          center: { latitude: coords.lat, longitude: coords.lng },
          radius: BRIDGE_BIAS_RADIUS_M,
        },
      },
    },
    key,
  );
  const match = pickBridgeMatch(name, coords.lat, coords.lng, readPlaces(data));
  return match ? toCard(match, input.origin ?? "") : null;
}

async function readImage(res: Response): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (!res.ok) {
    fail("places_upstream", `Google Places photo request failed (${res.status}).`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    fail("places_upstream", "Google Places photo response was not an image.");
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    fail("places_upstream", "Google Places photo was empty or too large.");
  }
  return { bytes, contentType };
}

/** Download a Places photo without exposing the API key to the client. */
export async function fetchPlacePhoto(input: {
  name: string;
  maxWidthPx?: number | null;
}): Promise<{ bytes: Uint8Array; contentType: string }> {
  const key = requireGooglePlacesKey();
  const name = assertPhotoResourceName(input.name);
  const width = clampPhotoWidth(input.maxWidthPx);
  const endpoint = `${PLACES_BASE}/${name}/media?maxWidthPx=${width}&skipHttpRedirect=true`;
  const res = await fetch(endpoint, {
    headers: { "X-Goog-Api-Key": key },
    cache: "no-store",
    redirect: "manual",
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") || "";
    if (!location || location.includes(key)) {
      fail("places_upstream", "Google Places photo redirect was rejected.");
    }
    return readImage(await fetch(location, { cache: "no-store" }));
  }
  if (!res.ok) {
    fail("places_upstream", `Google Places photo request failed (${res.status}).`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as { photoUri?: unknown };
    const photoUri = typeof data.photoUri === "string" ? data.photoUri : "";
    if (!photoUri || photoUri.includes(key)) {
      fail("places_upstream", "Google Places photo response had no image.");
    }
    return readImage(await fetch(photoUri, { cache: "no-store" }));
  }
  return readImage(res);
}

export function googlePlacesErrorResponse(err: unknown): Response {
  const code = (err as { code?: string }).code ?? "error";
  const message = (err as { message?: string }).message;
  const status =
    code === "google_places_not_configured"
      ? 503
      : code === "invalid"
        ? 400
        : code === "places_upstream"
          ? 502
          : 500;
  const safeMessage =
    code === "google_places_not_configured" || code === "invalid" || code === "places_upstream"
      ? message
      : undefined;
  return Response.json({ error: code, message: safeMessage }, { status });
}
