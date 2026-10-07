/** Browser CORS for `/api/*`. Native apps ignore these headers. */

const ALLOW_HEADERS = "Content-Type, X-Host-Token, X-Claim-Token";
const ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";

/**
 * `ALLOWED_ORIGINS` comma-separated. Unset (`null`) reflects the request origin
 * so local dev and Expo web work. An empty list allows no browser origin.
 */
export function parseAllowedOrigins(raw: string | undefined | null): string[] | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Origin to echo, or null when the browser must not be granted access.
 * Exact match against the allowlist (browsers send a canonical Origin).
 */
export function accessControlAllowOrigin(requestOrigin: string | null, allowlist: string[] | null): string | null {
  if (!allowlist) {
    if (requestOrigin && requestOrigin !== "null") return requestOrigin;
    return "*";
  }
  if (requestOrigin && allowlist.includes(requestOrigin)) return requestOrigin;
  return null;
}

export function corsHeadersFor(requestOrigin: string | null, allowlist: string[] | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Expose-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  const allow = accessControlAllowOrigin(requestOrigin, allowlist);
  if (allow) headers["Access-Control-Allow-Origin"] = allow;
  return headers;
}
