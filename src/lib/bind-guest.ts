import { api, getClaimTokens } from "./session";
import type { Claim } from "./types";

/**
 * Stamp this device's guestId onto claims it can prove with owner tokens.
 * Returns true when the server changed at least one claim.
 */
export async function bindOwnedClaims(
  receiptId: string,
  guestId: string,
  claims: Pick<Claim, "id" | "guestId">[],
): Promise<boolean> {
  const held = getClaimTokens(receiptId);
  const tokens: Record<string, string> = {};
  for (const claim of claims) {
    const token = held[claim.id];
    if (!token) continue;
    if (claim.guestId === guestId) continue;
    tokens[claim.id] = token;
  }
  if (Object.keys(tokens).length === 0) return false;
  const result = await api<{ updated: number }>(`/api/receipts/${receiptId}/guest`, {
    method: "POST",
    body: JSON.stringify({ guestId, tokens }),
  });
  return result.updated > 0;
}
