import {
  fetchPickedGooglePlace,
  googlePlacesErrorResponse,
} from "@/lib/google-places";

export const dynamic = "force-dynamic";

/**
 * Place Details Enterprise for the one Google place the user picked
 * (Plan here / detail screen). Nearby search does not call this.
 *
 * Query: `placeId` (required) — a Google place id from nearby or the bridge.
 * Mapbox and MapKit ids are rejected and are not sent to Google.
 *
 * 200 `{ place }` includes `rating`, `userRatingCount`, and `websiteUri`
 * when Google has them. `photoUrl` is null here; keep the nearby card's
 * proxied photo. 400 bad id. 503 when `GOOGLE_PLACES_API_KEY` is missing
 * or blank (no Google call). 502 when Google fails.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const place = await fetchPickedGooglePlace({
      placeId: url.searchParams.get("placeId") ?? "",
      origin: url.origin,
    });
    return Response.json({ place });
  } catch (err) {
    return googlePlacesErrorResponse(err);
  }
}
