import {
  fetchPlacePhoto,
  googlePlacesErrorResponse,
  PHOTO_CACHE_CONTROL,
} from "@/lib/google-places";

export const dynamic = "force-dynamic";

/**
 * Proxied Place Photo (New). The API key stays on the server.
 *
 * Query: `name` (required) `places/{placeId}/photos/{ref}`,
 * `maxWidthPx` (optional, default 400, never above 400).
 *
 * 200: image bytes. The server stores each photo ref and does not call Google
 * again for that ref. 400 bad name. 503 when `GOOGLE_PLACES_API_KEY` is
 * missing or blank and this ref is not stored. 502 when Google fails.
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
        "Cache-Control": PHOTO_CACHE_CONTROL,
      },
    });
  } catch (err) {
    return googlePlacesErrorResponse(err);
  }
}
