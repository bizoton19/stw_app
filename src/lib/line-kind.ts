/**
 * Classify a place into restaurant | bar | grocery | null (no kind icon).
 *
 * Callers pass provider category strings through unchanged. This function
 * normalizes them into words before matching:
 * - MapKit: `MKPointOfInterestCategory.rawValue` (`MKPOICategoryRestaurant`,
 *   `MKPOICategoryCafe`, `MKPOICategoryNightlife`, `MKPOICategoryFoodMarket`, …).
 *   The iOS bridge emits that raw value; do not slug it in Swift.
 * - Google Places primaryType / types: `italian_restaurant`, `coffee_shop`, `night_club`.
 * - Mapbox poi_category: `restaurant`, `cafe`, `wine_bar`, `fast_food`.
 *
 * Keep this word list in sync with `apps/mobile/src/lib/line-kind.ts`.
 */
export type VenueKind = "restaurant" | "bar" | "grocery";

const BAR =
  /\b(bar|pub|nightlife|night club|wine bar|brewery|winery|beer|speakeasy|lounge)\b/i;
const GROCERY =
  /\b(grocery|supermarket|super market|convenience( store)?|liquor store|bodega|food market)\b/i;
const RESTAURANT =
  /\b(restaurant|cafe|café|bakery|coffee shop|coffee|food|bistro|diner|eatery|steakhouse|steak house|pizzeria|sushi|fast food|food and drink)\b/i;

/** Strip MapKit's MKPOICategory prefix, split camelCase, and unfold snake_case. */
function venueKindHaystack(category?: string | null, name?: string | null): string {
  return `${category ?? ""} ${name ?? ""}`
    .replace(/MKPOICategory/gi, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyVenueKind(
  category?: string | null,
  name?: string | null,
): VenueKind | null {
  const hay = venueKindHaystack(category, name);
  if (!hay) return null;
  // Bars before grocery/restaurant — "wine bar" / "brewery" should not become food.
  if (BAR.test(hay)) return "bar";
  if (GROCERY.test(hay)) return "grocery";
  if (RESTAURANT.test(hay)) return "restaurant";
  return null;
}

export type LineKind = "food" | "drink";

const DRINK =
  /\b(wine|beer|ale|lager|stout|ipa|cocktail|negroni|martini|old\s*fashioned|margarita|mojito|spritz|champagne|prosecco|whiskey|whisky|bourbon|rye|vodka|gin|rum|tequila|mezcal|cognac|brandy|liqueur|aperol|campari|espresso\s*martini|latte|cappuccino|macchiato|americano|coffee|espresso|tea|matcha|juice|soda|cola|water|sparkling|kombucha|cider|shot|digestif|aperitif|kir|royale|botanist|reposado|mocktail|smoothie|n\/a|\bna\b)\b/i;

const FOOD =
  /\b(salad|burger|fries|steak|chicken|pork|beef|fish|salmon|tuna|oyster|shrimp|lobster|pasta|pizza|soup|sandwich|taco|burrito|rice|noodle|dessert|cake|pie|cheese|charcuterie|bread|wing|nacho|schnitzel|spätzli|spaetzle|entree|entrée|appetizer|starter)\b/i;

export function classifyLineKind(name: string): LineKind | null {
  const n = name.trim();
  if (!n) return null;
  const drink = DRINK.test(n);
  const food = FOOD.test(n);
  if (drink && !food) return "drink";
  if (food && !drink) return "food";
  if (drink && food) return "drink";
  return null;
}
