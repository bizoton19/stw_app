"use client";

import { useEffect } from "react";
import { bindOwnedClaims } from "@/lib/bind-guest";
import { getGuest } from "@/lib/session";
import type { Claim } from "@/lib/types";

/** Attach guestId to claims this browser still owns, then refresh once. */
export function useBindGuestClaims(
  receiptId: string,
  claims: Claim[],
  refresh: () => Promise<unknown> | unknown,
) {
  const guestId = getGuest(receiptId)?.guestId ?? "";
  const signature = claims
    .filter((claim) => claim.guestId !== guestId)
    .map((claim) => claim.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!guestId || !signature) return;
    let cancelled = false;
    void bindOwnedClaims(receiptId, guestId, claims)
      .then((changed) => {
        if (changed && !cancelled) void refresh();
      })
      .catch(() => {
        /* next visit retries */
      });
    return () => {
      cancelled = true;
    };
  }, [receiptId, guestId, signature, claims, refresh]);
}
