/**
 * Keep the host assistant on Split the Wine work only.
 * Cheap gate before / after the model — no general chat.
 */

const OFF_TOPIC_REFUSAL =
  "I only help with this tab — items, fees, tax/tip, pours, and the numbers on the check. Ask about those.";

/** Clear off-topic intents (not receipt/split related). */
const OFF_TOPIC =
  /\b(weather|joke|poem|story|recipe(?!.*(tip|tax|split))|homework|essay|code|python|javascript|typescript|sql|bitcoin|crypto|stock|dating|girlfriend|boyfriend|politics|election|trump|biden|news|sports|nba|nfl|soccer|movie|netflix|spotify|translate this|write (?:me )?a|act as|jailbreak|ignore (?:your|previous) instructions|system prompt)\b/i;

/** Strong on-topic signals for this product. */
const ON_TOPIC =
  /\b(tip|gratuity|cash\s*tip|tax|vat|mwst|sales\s*tax|fee|subtotal|total|owe|owed|split|claim|item|line|bottle|glass|pour|wine|drink|food|receipt|check|tab|venmo|cash\s*app|paypal|zelle|pay|handle|qty|quantity|price|cost|percent|%|dollar|\$|math|add|sum|remaining|unclaimed|restaurant|venue|place|service\s*charge|how much|what(?:'s| is) (?:still |left )?on|merge|remove|delete|edit|wrong|missing|blank)\b/i;

export function offTopicRefusal(): string {
  return OFF_TOPIC_REFUSAL;
}

/**
 * Returns true when the host message is clearly outside app context.
 * Empty / missing message = in scope (opening the sheet).
 */
export function isClearlyOffTopic(message: string | undefined | null): boolean {
  const text = message?.trim() ?? "";
  if (!text) return false;
  if (OFF_TOPIC.test(text) && !ON_TOPIC.test(text)) return true;
  // Long free-form with zero product terms → treat as off-topic.
  if (text.length > 80 && !ON_TOPIC.test(text) && !/\$|\d/.test(text)) return true;
  return false;
}

/**
 * Ambiguous short messages still go to the model with a hard system scope.
 */
export function isLikelyOnTopic(message: string | undefined | null): boolean {
  const text = message?.trim() ?? "";
  if (!text) return true;
  if (isClearlyOffTopic(text)) return false;
  return ON_TOPIC.test(text) || /\$|\d/.test(text) || text.length <= 40;
}
