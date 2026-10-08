import { shouldShowNearbyCards } from "./nearby-places";

/** Step 3 footer. "Swipe nearby places" only when those cards are on screen or loading. */
export function placeStepFooter(input: {
  placeLocked: boolean;
  query: string;
  nearbyVisible: boolean;
}): string {
  if (input.placeLocked) return "This place pins on the claim board for your guests.";
  if (!shouldShowNearbyCards(input.query)) {
    return "Pick a match from the list — we won’t continue until you tap one.";
  }
  if (input.nearbyVisible) {
    return "Swipe nearby places, or type at least two letters to search.";
  }
  return "Type at least two letters to search by name.";
}

/**
 * Step 3 treats nearby as on screen while we might still show cards:
 * permission not read yet, a granted fix still in flight, a fetch in flight,
 * or at least one card back.
 * Fall back only when permission is not granted, the fix failed, or the
 * settled list is empty.
 */
export function nearbyCardsAreVisible(input: {
  permission: "granted" | "denied" | "undetermined" | null;
  positionUnavailable: boolean;
  hasCoords: boolean;
  query: string;
  pending: boolean;
  count: number;
}): boolean {
  if (!shouldShowNearbyCards(input.query)) return false;
  if (input.permission == null) return true;
  if (input.permission !== "granted") return false;
  if (input.positionUnavailable) return false;
  if (!input.hasCoords) return true;
  return input.pending || input.count > 0;
}
