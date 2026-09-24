import { mapboxAutocomplete, placesConfigured } from "@/lib/places";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!placesConfigured()) {
      return Response.json({ predictions: [], configured: false });
    }
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const session = url.searchParams.get("session") ?? "";
    const latRaw = url.searchParams.get("lat");
    const lngRaw = url.searchParams.get("lng");
    const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : null;
    const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : null;

    const predictions = await mapboxAutocomplete({
      q,
      session: session || crypto.randomUUID(),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    });
    return Response.json({ predictions, configured: true, provider: "mapbox" });
  } catch (err) {
    return jsonError(err);
  }
}
