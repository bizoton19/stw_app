import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Allow the Expo native/web client (separate origin) to call the same Route Handlers. */
const ALLOW_HEADERS = "Content-Type, X-Host-Token, X-Claim-Token";
const ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";

function allowedOrigins(): string[] | null {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw) return null; // unset = reflect request origin (dev / Expo web convenience)
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const allowlist = allowedOrigins();
  let allowOrigin = "*";
  if (allowlist) {
    if (origin && allowlist.includes(origin)) allowOrigin = origin;
    else allowOrigin = allowlist[0] ?? "null";
  } else if (origin && origin !== "null") {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Expose-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
