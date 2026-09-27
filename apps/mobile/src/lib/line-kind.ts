/** Classify Places / MapKit category → restaurant | bar | grocery | null (no icon). */
export type VenueKind = "restaurant" | "bar" | "grocery";

const BAR = /\b(bar|pub|nightlife|night_club|wine_bar|brewery|beer|speakeasy|lounge)\b/i;
const GROCERY =
  /\b(grocery|supermarket|super_market|convenience(_store)?|liquor_store|liquor\s*store|bodega)\b/i;
const RESTAURANT =
  /\b(restaurant|cafe|café|bakery|food|bistro|diner|eatery|steakhouse|pizzeria|sushi|fast_food|food_and_drink)\b/i;

export function classifyVenueKind(
  category?: string | null,
  name?: string | null,
): VenueKind | null {
  const hay = `${category ?? ""} ${name ?? ""}`.trim();
  if (!hay) return null;
  // Bars before grocery/restaurant — "wine bar" / "brewery" should not become food.
  if (BAR.test(hay)) return "bar";
  if (GROCERY.test(hay)) return "grocery";
  if (RESTAURANT.test(hay)) return "restaurant";
  return null;
}

export type LineKind = "food" | "drink";

const DRINK =
  /\b(wine|beer|ale|lager|stout|ipa|cocktail|negroni|martini|old\s*fashioned|margarita|mojito|spritz|champagne|prosecco|whiskey|whisky|bourbon|rye|vodka|gin|rum|tequila|mezcal|cognac|brandy|liqueur|aperol|campari|espresso\s*martini|latte|cappuccino|macchiato|americano|coffee|espresso|tea|matcha|juice|soda|cola|water|sparkling|still\s*water|kombucha|cidre|cider|shot|digestif|aperitif|kir|royale|botanist|reposado|reposado|tequila|na\b|n\/a|mocktail|smoothie|milkshake)\b/i;

const FOOD =
  /\b(salad|burger|fries|steak|chicken|pork|beef|fish|salmon|tuna|oyster|oysters|shrimp|lobster|pasta|pizza|soup|sandwich|taco|taco|burrito|rice|noodle|dessert|cake|pie|cheese|charcuterie|bread|fries|wing|wings|nacho|fries|schnitzel|spätzli|spaetzle|schnitzel|entree|entrée|appetizer|starter|main|side|fries|fries)\b/i;

/** Prefer drink when both match (cocktails often include food words). */
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
