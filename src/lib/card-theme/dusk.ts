import { DEFAULT_CARD_THEME, isCardThemeId, type CardThemeId } from "./themes";

/**
 * The dusk window — see `plans/card-design-themes.md` §3.3. 19:00 was chosen over 18:00
 * so a 18:30 dinner doesn't open already dimmed. Naive on purpose: we store venue
 * coordinates, so a real sunset calculation is a possible upgrade, not a dependency now.
 *
 * `boot-script.ts` interpolates these two numbers, so changing them here changes the
 * pre-paint script too and stays covered by `dusk.test.ts`.
 */
export const DUSK_HOUR = 19;
export const DAWN_HOUR = 6;

/**
 * linen by day, candlelight after dusk. Local to whoever is looking at the card, so a
 * whole table stays visually consistent while a guest claiming the next morning
 * correctly sees the day theme.
 */
export function duskTheme(now: Date = new Date()): CardThemeId {
  const hour = now.getHours();
  // A nonsense device clock falls back to the approved default.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return DEFAULT_CARD_THEME;
  return hour >= DUSK_HOUR || hour < DAWN_HOUR ? "candlelight" : "linen";
}

/**
 * QA and screenshot override: `?cardTheme=candlelight`. Never surfaced to real users,
 * so an unrecognised value is ignored rather than reported.
 */
export function cardThemeOverride(search: string): CardThemeId | null {
  if (!search) return null;
  const value = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  ).get("cardTheme");
  return isCardThemeId(value) ? value : null;
}

/** The single entry point: an explicit override wins, otherwise the clock decides. */
export function resolveCardTheme(now: Date = new Date(), search = ""): CardThemeId {
  return cardThemeOverride(search) ?? duskTheme(now);
}
