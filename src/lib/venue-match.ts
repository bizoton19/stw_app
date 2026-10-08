/**
 * Soft name compare for planned venue vs OCR restaurant.
 * Returns true when we should warn the host they may have scanned the wrong check.
 */
export function venueNamesLikelyDifferent(
  planned: string | null | undefined,
  scanned: string | null | undefined,
): boolean {
  const a = normalizeVenueName(planned);
  const b = normalizeVenueName(scanned);
  if (!a || !b) return false;
  if (a === b) return false;
  if (a.includes(b) || b.includes(a)) return false;

  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return true;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap += 1;
  }
  const denom = Math.min(tokensA.size, tokensB.size);
  return overlap / denom < 0.4;
}

function normalizeVenueName(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "the",
  "and",
  "bar",
  "cafe",
  "café",
  "restaurant",
  "kitchen",
  "grill",
  "house",
  "llc",
  "inc",
]);

function significantTokens(name: string): Set<string> {
  return new Set(
    name
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}
