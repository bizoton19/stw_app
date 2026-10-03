import {
  bridgePlaceToGoogle,
  googlePlacesErrorResponse,
} from "@/lib/google-places";

export const dynamic = "force-dynamic";

/**
 * Typeahead → Google place id.
 *
 * Query: `name` (required), `lat` (required), `lng` (required).
 * `placeId` is ignored. Mapbox and MapKit ids are not Google place ids and
 * are never sent to Place Details.
 *
 * 200 `{ bridged: true, place: GooglePlaceCard }` when Text Search matches.
 * 200 `{ bridged: false, place: null }` when nothing confident matches.
 * 400 missing name or coordinates. 503 when `GOOGLE_PLACES_API_KEY` is missing
 * or blank (no Google call). Callers then keep provider `mapbox` or `apple`.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const latRaw = url.searchParams.get("lat");
    const lngRaw = url.searchParams.get("lng");
    if (latRaw == null || latRaw.trim() === "" || lngRaw == null || lngRaw.trim() === "") {
      return Response.json(
        { error: "invalid", message: "name, lat, and lng are required." },
        { status: 400 },
      );
    }
    const place = await bridgePlaceToGoogle({
      name: url.searchParams.get("name") ?? "",
      lat: Number(latRaw),
      lng: Number(lngRaw),
      origin: url.origin,
    });
    if (!place) {
      return Response.json({ bridged: false, place: null });
    }
    return Response.json({ bridged: true, place });
  } catch (err) {
    return googlePlacesErrorResponse(err);
  }
}
