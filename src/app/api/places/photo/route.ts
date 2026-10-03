import {
  fetchPlacePhoto,
  googlePlacesErrorResponse,
} from "@/lib/google-places";

export const dynamic = "force-dynamic";

/**
 * Proxied Place Photo (New). The API key stays on the server.
 *
 * Query: `name` (required) `places/{placeId}/photos/{ref}`,
 * `maxWidthPx` (optional, default 400, never above 400).
 *
 * 200: image bytes. 400 bad name. 503 when `GOOGLE_PLACES_API_KEY` is missing
 * or blank (no Google call). 502 when Google fails.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawWidth = url.searchParams.get("maxWidthPx");
    const photo = await fetchPlacePhoto({
      name: url.searchParams.get("name") ?? "",
      maxWidthPx: rawWidth != null && rawWidth.trim() !== "" ? Number(rawWidth) : undefined,
    });
    return new Response(Buffer.from(photo.bytes), {
      status: 200,
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return googlePlacesErrorResponse(err);
  }
}
