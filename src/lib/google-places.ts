/**
 * Server-only Google Places API (New) client.
 *
 * `GOOGLE_PLACES_API_KEY` is read here and sent only as the `X-Goog-Api-Key`
 * header. Do not import this module from a Client Component — Next can inline
 * `process.env.*` into the browser bundle. Mobile and web call the routes.
 *
 * Nearby uses `places:searchNearby` (top 7, popularity, primary food/drink
 * types, Nearby Search Pro field mask). Each neighborhood cell is stored for
 * 30 days in Postgres, or on local disk when there is no database. Stale
 * openings and closures in that window are accepted. Results with no
 * coordinates or coordinates outside the requested radius are dropped. The
 * nearby mask does not include rating, userRatingCount, or websiteUri —
 * those bill the whole search as Enterprise.
 * Photos are proxied. A stored photo ref is not fetched from Google again.
 * The typeahead bridge uses Text Search
 * (`places:searchText`) with the place **name** and **lat/lng** and an
 * Essentials (IDs Only) field mask. Place Details Enterprise runs only for
 * the one Google place a caller asks to detail. Mapbox and MapKit ids are
 * never sent to Place Details.
 *
 * Without a non-empty key every function throws `google_places_not_configured`
 * before `fetch`.
 */

import {
  clearPlacesCache,
  forgetPlacesCacheMemory,
  NEARBY_CACHE_MAX_AGE_SECONDS,
  NEARBY_CACHE_TTL_MS,
  PHOTO_CACHE_CONTROL,
  readCachedPhoto,
  readNearbyPlaces,
  writeCachedPhoto,
  writeNearbyPlaces,
} from "./places-cache";

const PLACES_BASE = "https://places.googleapis.com/v1";

export { NEARBY_CACHE_MAX_AGE_SECONDS, NEARBY_CACHE_TTL_MS, PHOTO_CACHE_CONTROL };

export const NEARBY_LIMIT = 7;
export const NEARBY_GEOHASH_PRECISION = 6;
export const PHOTO_MAX_WIDTH_PX = 400;
export const DEFAULT_NEARBY_RADIUS_M = 1500;

const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 50_000;
const BRIDGE_BIAS_RADIUS_M = 500;
const MAX_PHOTO_BYTES = 5_000_000;
const MAX_NAME_LENGTH = 200;

/**
 * General Table A primary types. Nearby Search still returns more specific
 * primary types such as `italian_restaurant` when `restaurant` is included.
 */
const NEARBY_PRIMARY_TYPES = ["restaurant", "bar", "cafe", "bakery", "coffee_shop"];

/** Nearby Search Pro. Rating, userRatingCount, and websiteUri are Enterprise. */
const NEARBY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.photos",
  "places.googleMapsUri",
  "places.primaryType",
].join(",");

/** Text Search Essentials (IDs Only). `places.name` is the resource name, not displayName. */
const TEXT_SEARCH_ID_FIELD_MASK = ["places.id", "places.name"].join(",");

/**
 * Place Details for one picked place. Rating and websiteUri make this
 * Enterprise. Photos stay on the nearby Pro response and the photo proxy.
 */
const PICKED_PLACE_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "websiteUri",
].join(",");

const GOOGLE_PLACE_ID = /^[A-Za-z0-9_-]{8,255}$/;

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
  /** Present after Place Details for a picked place. Nearby and bridge omit these. */
  rating?: number | null;
  userRatingCount?: number | null;
  /** Proxied `/api/places/photo` URL. Never a Google URL that carries the API key. */
  photoUrl: string | null;
  websiteUri?: string | null;
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

let clock = () => Date.now();
const nearbyInflight = new Map<string, Promise<NearbySearchResult>>();
const photoInflight = new Map<string, Promise<{ bytes: Uint8Array; contentType: string }>>();

export async function clearNearbyCache(): Promise<void> {
  nearbyInflight.clear();
  photoInflight.clear();
  await clearPlacesCache();
}

/** @internal Drops process memory so tests can prove the durable store. */
export function forgetPlacesCacheProcessMemoryForTests(): void {
  forgetPlacesCacheMemory();
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

function toCard(
  place: NormalizedPlace,
  origin: string,
  fields: "pro" | "enterprise",
): GooglePlaceCard {
  const path = place.photoName ? proxiedPhotoPath(place.photoName) : null;
  const base = origin.replace(/\/$/, "");
  const card: GooglePlaceCard = {
    placeId: place.placeId,
    name: place.name,
    formattedAddress: place.formattedAddress,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
    provider: "google",
    photoUrl: path ? (base ? `${base}${path}` : path) : null,
    googleMapsUri: place.googleMapsUri,
  };
  if (fields === "enterprise") {
    card.rating = place.rating;
    card.userRatingCount = place.userRatingCount;
    card.websiteUri = place.websiteUri;
  }
  return card;
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

async function googlePost(
  methodPath: "places:searchNearby" | "places:searchText",
  body: unknown,
  key: string,
  fieldMask: string,
): Promise<unknown> {
  const res = await fetch(`${PLACES_BASE}/${methodPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    fail("places_upstream", `Google Places request failed (${res.status}).`);
  }
  return res.json();
}

export function assertGooglePlaceId(raw: string): string {
  const trimmed = raw.trim().replace(/^places\//, "");
  if (!GOOGLE_PLACE_ID.test(trimmed)) {
    fail("invalid", "placeId must be a Google place id.");
  }
  return trimmed;
}

function readTextSearchPlaceId(data: unknown): string | null {
  const places = (data as { places?: unknown } | null)?.places;
  if (!Array.isArray(places)) return null;
  for (const row of places) {
    if (!row || typeof row !== "object") continue;
    const place = row as { id?: unknown; name?: unknown };
    const rawId = typeof place.id === "string" ? place.id.trim() : "";
    const resource = typeof place.name === "string" ? place.name.trim() : "";
    const candidate = rawId || resource;
    if (!candidate) continue;
    try {
      return assertGooglePlaceId(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

export async function searchNearby(input: {
  lat: number;
  lng: number;
  radius?: number;
  origin?: string;
}): Promise<NearbySearchResult> {
  const coords = assertCoords(input.lat, input.lng);
  const radius = clampRadius(input.radius);
  const cacheKey = nearbyCacheKey(coords.lat, coords.lng, radius);
  const origin = input.origin ?? "";
  const cached = await readNearbyPlaces<NormalizedPlace>(cacheKey, clock());
  if (cached) {
    return {
      places: cached.slice(0, NEARBY_LIMIT).map((place) => toCard(place, origin, "pro")),
      provider: "google",
      limit: NEARBY_LIMIT,
      cached: true,
    };
  }
  const pending = nearbyInflight.get(cacheKey);
  if (pending) return pending;
  const promise = loadNearby(coords, radius, cacheKey, origin);
  nearbyInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    nearbyInflight.delete(cacheKey);
  }
}

async function loadNearby(
  coords: { lat: number; lng: number },
  radius: number,
  cacheKey: string,
  origin: string,
): Promise<NearbySearchResult> {
  const key = requireGooglePlacesKey();
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
    NEARBY_FIELD_MASK,
  );
  const places = readPlaces(data)
    .filter((place) => placeInsideNearbyRadius(place, coords.lat, coords.lng, radius))
    .slice(0, NEARBY_LIMIT);
  await writeNearbyPlaces(cacheKey, places, clock());
  return {
    places: places.map((place) => toCard(place, origin, "pro")),
    provider: "google",
    limit: NEARBY_LIMIT,
    cached: false,
  };
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

/**
 * Resolve a typeahead selection to a Google place id.
 * Text Search Essentials (IDs Only) by name + coordinates. The response keeps
 * the queried name and coordinates. Rating and website come from
 * `fetchPickedGooglePlace` after the user opens that one place.
 * `placeId` is intentionally not a parameter — Mapbox and MapKit ids must
 * not be sent to Place Details. Returns null when Google returns no id.
 * Throws when the key is missing.
 */
export async function bridgePlaceToGoogle(input: {
  name: string;
  lat: number;
  lng: number;
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
      maxResultCount: 1,
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
    TEXT_SEARCH_ID_FIELD_MASK,
  );
  const placeId = readTextSearchPlaceId(data);
  if (!placeId) return null;
  return {
    placeId,
    name,
    formattedAddress: null,
    lat: coords.lat,
    lng: coords.lng,
    category: null,
    provider: "google",
    photoUrl: null,
    googleMapsUri: null,
  };
}

/**
 * Place Details Enterprise for the one place the user picked.
 * Not used by nearby search. Callers that do not need rating or website
 * should skip this.
 */
export async function fetchPickedGooglePlace(input: {
  placeId: string;
  origin?: string;
}): Promise<GooglePlaceCard> {
  const placeId = assertGooglePlaceId(input.placeId);
  const key = requireGooglePlacesKey();
  const endpoint = `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(endpoint, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": PICKED_PLACE_FIELD_MASK,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    fail("places_upstream", `Google Places request failed (${res.status}).`);
  }
  const place = normalizePlace(await res.json());
  if (!place) {
    fail("places_upstream", "Google Places details had no place.");
  }
  return toCard(place, input.origin ?? "", "enterprise");
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
  const name = assertPhotoResourceName(input.name);
  const cached = await readCachedPhoto(name);
  if (cached) return cached;
  const pending = photoInflight.get(name);
  if (pending) return pending;
  const promise = loadPlacePhoto(name, input.maxWidthPx);
  photoInflight.set(name, promise);
  try {
    return await promise;
  } finally {
    photoInflight.delete(name);
  }
}

async function loadPlacePhoto(
  name: string,
  maxWidthPx: number | null | undefined,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const key = requireGooglePlacesKey();
  const width = clampPhotoWidth(maxWidthPx);
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
    return storePhoto(name, await readImage(await fetch(location, { cache: "no-store" })));
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
    return storePhoto(name, await readImage(await fetch(photoUri, { cache: "no-store" })));
  }
  return storePhoto(name, await readImage(res));
}

async function storePhoto(
  name: string,
  photo: { bytes: Uint8Array; contentType: string },
): Promise<{ bytes: Uint8Array; contentType: string }> {
  await writeCachedPhoto(name, photo);
  return photo;
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
