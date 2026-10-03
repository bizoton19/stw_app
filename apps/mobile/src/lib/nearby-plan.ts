import type { NearbyPlaceCard } from "./nearby-places";

type Pending = {
  card: NearbyPlaceCard;
  onPlan: (card: NearbyPlaceCard) => void;
};

let pending: Pending | null = null;

/** Holds the tapped card until Plan here or the detail screen is left. */
export function rememberNearbyPlan(card: NearbyPlaceCard, onPlan: Pending["onPlan"]) {
  pending = { card, onPlan };
}

export function currentNearbyPlan(): Pending | null {
  return pending;
}
