/** Classify Places category → restaurant | bar | null. */
export type VenueKind = "restaurant" | "bar";

const BAR = /\b(bar|pub|nightlife|night_club|wine_bar|brewery|beer|speakeasy|lounge)\b/i;
const RESTAURANT =
  /\b(restaurant|cafe|café|bakery|food|bistro|diner|eatery|steakhouse|pizzeria|sushi)\b/i;

export function classifyVenueKind(
  category?: string | null,
  name?: string | null,
): VenueKind | null {
  const hay = `${category ?? ""} ${name ?? ""}`.trim();
  if (!hay) return null;
  if (BAR.test(hay)) return "bar";
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
