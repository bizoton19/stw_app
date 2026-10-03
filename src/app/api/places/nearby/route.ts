import {
  googlePlacesErrorResponse,
  parseLatLng,
  searchNearby,
} from "@/lib/google-places";

export const dynamic = "force-dynamic";

/**
 * Nearby food and drink, Google Places Nearby (New), server proxy.
 *
 * Query: `lat` (required), `lng` (required), `radius` (optional meters,
 * default 1500, clamped 50–50000).
 *
 * 200: `{ places: GooglePlaceCard[], provider: "google", limit: 7, cached }`
 * `places[].photoUrl` is this API’s `/api/places/photo` URL (max width 400).
 * 400 invalid coordinates. 503 when `GOOGLE_PLACES_API_KEY` is missing or blank
 * (no Google call). 502 when Google fails.
 *
 * Results are cached in-process for 8 minutes by geohash-6 + radius bucket.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { lat, lng } = parseLatLng(url.searchParams.get("lat"), url.searchParams.get("lng"));
    const radiusRaw = url.searchParams.get("radius");
    const radius =
      radiusRaw != null && radiusRaw.trim() !== "" ? Number(radiusRaw) : undefined;
    const result = await searchNearby({ lat, lng, radius, origin: url.origin });
    return Response.json(result, {
      headers: { "Cache-Control": "private, max-age=480" },
    });
  } catch (err) {
    return googlePlacesErrorResponse(err);
  }
}
