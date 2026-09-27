import { getApiUrl } from "./config";

/**
 * Small warm palette for Mapbox pins — one color per place key so a host’s
 * handful of venues stay visually distinct on the desk.
 */
export const PLACE_PIN_PALETTE = [
  "6E2E35", // merlot
  "2F5D50", // bottle green
  "C9892A", // amber
  "3D5A80", // slate blue
  "8B5E3C", // cognac
  "5C4B7A", // plum
  "2A6F6F", // teal
  "9C1F3D", // berry
] as const;

export function placePinColor(seed: string | null | undefined): string {
  const s = (seed || "").trim();
  if (!s) return PLACE_PIN_PALETTE[0];
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PLACE_PIN_PALETTE[Math.abs(h) % PLACE_PIN_PALETTE.length];
}

/** Proxied Mapbox Static Image — token stays on the API. */
export function staticMapUri(opts: {
  lat: number;
  lng: number;
  w: number;
  h: number;
  color?: string;
  z?: number;
}): string {
  const params = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
    w: String(opts.w),
    h: String(opts.h),
  });
  if (opts.color) params.set("color", opts.color.replace(/^#/, ""));
  if (opts.z != null) params.set("z", String(opts.z));
  return `${getApiUrl()}/api/places/static-map?${params}`;
}
