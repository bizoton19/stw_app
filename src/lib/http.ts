import { NextResponse } from "next/server";

export function hostTokenOf(req: Request): string | null {
  return req.headers.get("x-host-token");
}

export function claimTokenOf(req: Request): string | null {
  return req.headers.get("x-claim-token");
}

export function jsonError(err: unknown) {
  const code =
    (err as { code?: string }).code ?? "error";
  const remaining = (err as { remaining?: number }).remaining;
  const itemId = (err as { itemId?: string }).itemId;
  const itemName = (err as { itemName?: string }).itemName;
  const claimedBy = (err as { claimedBy?: string }).claimedBy;
  const existingId = (err as { existingId?: string }).existingId;
  const message = (err as { message?: string }).message;
  const status =
    code === "not_found"
      ? 404
      : code === "forbidden"
        ? 403
        : code === "not_enough_remaining" || code === "conflict" || code === "venue_day_taken"
          ? 409
          : code === "invalid"
            ? 400
            : code === "places_upstream"
              ? 502
              : 500;
  return NextResponse.json(
    { error: code, remaining, itemId, itemName, claimedBy, existingId, message },
    { status },
  );
}

export const noStore = {
  headers: {
    "Cache-Control": "no-store",
  },
};
