import { placesConfigured } from "@/lib/places";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX = 1280;

export async function GET(req: Request) {
  try {
    if (!placesConfigured()) {
      return Response.json({ error: "places_not_configured" }, { status: 503 });
    }
    const token = process.env.MAPBOX_ACCESS_TOKEN!.trim();
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    let w = Math.round(Number(url.searchParams.get("w") || 600));
    let h = Math.round(Number(url.searchParams.get("h") || 220));
    w = Math.min(MAX, Math.max(120, w));
    h = Math.min(MAX, Math.max(120, h));

    // Light style + merlot pin — matches paper / merlot product chrome.
    const overlay = `pin-s+6E2E35(${lng},${lat})`;
    const path = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlay}/${lng},${lat},14,0/${w}x${h}@2x`;
    const mapUrl = `${path}?access_token=${encodeURIComponent(token)}`;

    const res = await fetch(mapUrl, { cache: "force-cache" });
    if (!res.ok) {
      return Response.json({ error: "places_upstream" }, { status: 502 });
    }
    const bytes = await res.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
