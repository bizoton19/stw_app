/** Stable Mapbox pin colors per place — shared by static-map proxy callers. */
export const PLACE_PIN_PALETTE = [
  "6E2E35",
  "2F5D50",
  "C9892A",
  "3D5A80",
  "8B5E3C",
  "5C4B7A",
  "2A6F6F",
  "9C1F3D",
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
