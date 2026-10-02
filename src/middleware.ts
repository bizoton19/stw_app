import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeadersFor, parseAllowedOrigins } from "./lib/cors";

/** Allow the Expo native/web client (separate origin) to call the same Route Handlers. */
export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeadersFor(origin, parseAllowedOrigins(process.env.ALLOWED_ORIGINS));
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
