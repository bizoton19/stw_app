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
 * Text Search Essentials (IDs Only): field mask `places.id,places.name`.
 * 200 `{ bridged: true, place }` with the Google id, the queried name, and
 * the queried coordinates. `rating`, `userRatingCount`, and `websiteUri`
 * are omitted. Place Details is not called here.
 * 200 `{ bridged: false, place: null }` when Google returns no id.
 * 400 missing name or coordinates. 503 when `GOOGLE_PLACES_API_KEY` is missing
 * or blank (no Google call). Callers then keep provider `mapbox` or `apple`.
 *
 * Rating and website: `GET /api/places/google?placeId=` after the user picks
 * this place on the plan / detail screen.
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
    });
    if (!place) {
      return Response.json({ bridged: false, place: null });
    }
    return Response.json({ bridged: true, place });
  } catch (err) {
    return googlePlacesErrorResponse(err);
  }
}
