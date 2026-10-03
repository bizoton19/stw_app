import {
  googlePlacesErrorResponse,
  NEARBY_CACHE_MAX_AGE_SECONDS,
  parseLatLng,
  publicOriginFromRequest,
  searchNearby,
} from "@/lib/google-places";

export const dynamic = "force-dynamic";

/**
 * Nearby food and drink, Google Places Nearby (New), server proxy.
 *
 * Query: `lat` (required), `lng` (required), `radius` (optional meters,
 * default 1500, clamped 50–50000). Ranked by popularity. Primary types:
 * restaurant, bar, cafe, bakery, coffee_shop (specific types such as
 * italian_restaurant still match). Places with no coordinates, or
 * coordinates outside the radius, are omitted.
 *
 * Field mask is Nearby Search Pro. The response omits `rating`,
 * `userRatingCount`, and `websiteUri`. Those are loaded later with
 * `GET /api/places/google` for the one place the user picks.
 *
 * 200: `{ places: GooglePlaceCard[], provider: "google", limit: 7, cached }`
 * `places[].photoUrls` is at most two `/api/places/photo` URLs.
 * `places[].photoUrl` is the first of those, or null. Absolute URLs use the
 * request `x-forwarded-host` or `Host` (and `x-forwarded-proto`). A host of
 * `0.0.0.0` is ignored; the path is then relative. Photo bytes are cached
 * indefinitely by Google photo id and are not fetched again.
 * 400 invalid coordinates. 503 when `GOOGLE_PLACES_API_KEY` is missing or blank
 * and this cell is not already cached. 502 when Google fails.
 *
 * Each neighborhood cell (geohash-6 + radius rounded to 100 m) is stored for
 * 30 days in Postgres, or on local disk when `DATABASE_URL` is unset. One
 * Google Nearby call per cell per month. Stale openings and closures are
 * accepted. The cache survives a process restart.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { lat, lng } = parseLatLng(url.searchParams.get("lat"), url.searchParams.get("lng"));
    const radiusRaw = url.searchParams.get("radius");
    const radius =
      radiusRaw != null && radiusRaw.trim() !== "" ? Number(radiusRaw) : undefined;
    const result = await searchNearby({
      lat,
      lng,
      radius,
      origin: publicOriginFromRequest(req),
    });
    return Response.json(result, {
      headers: { "Cache-Control": `private, max-age=${NEARBY_CACHE_MAX_AGE_SECONDS}` },
    });
  } catch (err) {
    return googlePlacesErrorResponse(err);
  }
}
