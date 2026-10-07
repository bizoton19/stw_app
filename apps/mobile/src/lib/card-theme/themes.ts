/**
 * Card theme tokens for native — see `plans/card-design-themes.md` §3.
 *
 * Deliberately a copy of `src/lib/card-theme/themes.ts`, not an import: Metro's
 * project root is `apps/mobile`, so reaching into the web `src/` tree would mean
 * watch-folder plumbing for two small objects. The copy is held honest by
 * `src/lib/card-theme/dusk.test.ts`, which parses this file and fails if a single
 * token drifts from web.
 */

export const CARD_THEME_IDS = ["linen", "candlelight"] as const;

export type CardThemeId = (typeof CARD_THEME_IDS)[number];

export const DEFAULT_CARD_THEME: CardThemeId = "linen";

export type CardTheme = {
  paper: string;
  /** Raised surfaces: the "You owe" box, pay rows, link boxes. */
  sheet: string;
  ink: string;
  inkSoft: string;
  muted: string;
  border: string;
  /** Sticky bottom chrome (interview footer + host tab bar) — warmer than paper. */
  chrome: string;
  chromeBorder: string;
  merlot: string;
  merlotFg: string;
  /** Selected claim lines — bottle green, contrasts merlot CTAs on warm paper. */
  select: string;
  selectWash: string;
  danger: string;
  /** Line-kind chips — distinct from CTA merlot + select green. */
  kindDrink: string;
  kindDrinkWash: string;
  kindFood: string;
  kindFoodWash: string;
  /** Watermark tint for the `split-wash` motif. Carries its own alpha. */
  wash: string;
  /** Paper-grain opacity, capped at 2–4% per `ui-enhance.guide.md` §4. */
  grain: string;
};

export const cardThemes: Record<CardThemeId, CardTheme> = {
  linen: {
    paper: "#f6f4f1",
    sheet: "#fffcf8",
    ink: "#2a241c",
    inkSoft: "#7a7268",
    muted: "#8a847c",
    border: "#e6e0d8",
    chrome: "#ede8e1",
    chromeBorder: "#d4cdc3",
    merlot: "#6e2e35",
    merlotFg: "#fbf8f5",
    select: "#2f5d50",
    selectWash: "rgba(47, 93, 80, 0.14)",
    danger: "#a33b32",
    kindDrink: "#9c1f3d",
    kindDrinkWash: "rgba(156, 31, 61, 0.16)",
    kindFood: "#c9892a",
    kindFoodWash: "rgba(201, 137, 42, 0.22)",
    wash: "rgba(110, 46, 53, 0.05)",
    grain: "0.035",
  },
  candlelight: {
    paper: "#efe7dc",
    sheet: "#f8f2e8",
    ink: "#241c14",
    inkSoft: "#6e6253",
    muted: "#857a6a",
    border: "#dcd0be",
    chrome: "#e5dacb",
    chromeBorder: "#cdbfa9",
    merlot: "#7a2630",
    merlotFg: "#fbf5ec",
    select: "#2f5d50",
    selectWash: "rgba(47, 93, 80, 0.16)",
    danger: "#a33b32",
    kindDrink: "#9c1f3d",
    kindDrinkWash: "rgba(156, 31, 61, 0.18)",
    kindFood: "#c9892a",
    kindFoodWash: "rgba(201, 137, 42, 0.24)",
    wash: "rgba(201, 137, 42, 0.09)",
    grain: "0.05",
  },
};

export function isCardThemeId(value: unknown): value is CardThemeId {
  return typeof value === "string" && (CARD_THEME_IDS as readonly string[]).includes(value);
}

/** Unknown ids resolve to the approved default rather than throwing. */
export function resolveCardThemeTokens(id: unknown): CardTheme {
  return cardThemes[isCardThemeId(id) ? id : DEFAULT_CARD_THEME];
}
