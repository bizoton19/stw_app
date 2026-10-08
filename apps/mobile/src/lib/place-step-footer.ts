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
 * Nearby cards count as on screen while the first fetch is in flight
 * (`pending`), the row is loading, or at least one card came back.
 * An empty settled response is not "on screen".
 */
export function nearbyCardsAreVisible(input: {
  hasCoords: boolean;
  query: string;
  pending: boolean;
  count: number;
}): boolean {
  if (!input.hasCoords || !shouldShowNearbyCards(input.query)) return false;
  return input.pending || input.count > 0;
}
