import { mapboxDetails, placesConfigured } from "@/lib/places";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!placesConfigured()) {
      return Response.json({ error: "places_not_configured" }, { status: 503 });
    }
    const url = new URL(req.url);
    const placeId = url.searchParams.get("placeId") ?? "";
    const session = url.searchParams.get("session") ?? "";
    if (!placeId.trim()) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const place = await mapboxDetails({
      placeId: placeId.trim(),
      session: session || crypto.randomUUID(),
    });
    if (!place) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({ place });
  } catch (err) {
    return jsonError(err);
  }
}
