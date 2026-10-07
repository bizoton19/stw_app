/**
 * Card theme tokens — see `plans/card-design-themes.md` §3.
 *
 * `linen` is the day theme and holds the shipped palette exactly, so deleting
 * `candlelight` from this map leaves the app pixel-identical to before the theme work
 * (plan §6). Web paints these as CSS custom properties on `<html data-card-theme>`;
 * no component branches on the theme id at runtime.
 *
 * Token names mirror `apps/mobile/src/lib/theme.ts` so web and native speak one language.
 */

export const CARD_THEME_IDS = ["linen", "candlelight"] as const;

export type CardThemeId = (typeof CARD_THEME_IDS)[number];

/** Approved fallback whenever resolution is uncertain: bad clock, unknown id, no JS. */
export const DEFAULT_CARD_THEME: CardThemeId = "linen";

export type CardTheme = {
  /** Canvas behind everything. */
  paper: string;
  /** Raised surfaces: the "You owe" box, pay rows, link boxes. */
  sheet: string;
  ink: string;
  inkSoft: string;
  muted: string;
  /** Hairlines, dividers, tear lines. */
  border: string;
  /** Sticky bottom chrome — warmer than paper. */
  chrome: string;
  chromeBorder: string;
  merlot: string;
  merlotFg: string;
  /** Selected claim lines — bottle green, contrasts merlot CTAs on warm paper. */
  select: string;
  selectWash: string;
  danger: string;
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
  /**
   * Dusk variant — the same identity dimmed, never a second brand. Applied by the
   * clock only (§3.3). Washes lift slightly because the warmer paper swallows them;
   * `select`, `danger`, and the kind hues are deliberately unchanged so "claimed",
   * "destructive", and food/drink keep meaning exactly what they mean by day.
   */
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

/** Custom-property name per token — the contract `globals.css` is tested against. */
export const CARD_THEME_VARS: Record<keyof CardTheme, string> = {
  paper: "--stw-paper",
  sheet: "--stw-sheet",
  ink: "--stw-ink",
  inkSoft: "--stw-ink-soft",
  muted: "--stw-muted",
  border: "--stw-border",
  chrome: "--stw-chrome",
  chromeBorder: "--stw-chrome-border",
  merlot: "--stw-merlot",
  merlotFg: "--stw-merlot-fg",
  select: "--stw-select",
  selectWash: "--stw-select-wash",
  danger: "--stw-danger",
  kindDrink: "--stw-kind-drink",
  kindDrinkWash: "--stw-kind-drink-wash",
  kindFood: "--stw-kind-food",
  kindFoodWash: "--stw-kind-food-wash",
  wash: "--stw-wash",
  grain: "--stw-grain",
};

export function isCardThemeId(value: unknown): value is CardThemeId {
  return typeof value === "string" && (CARD_THEME_IDS as readonly string[]).includes(value);
}

/** Unknown ids resolve to the approved default rather than throwing. */
export function resolveCardThemeTokens(id: unknown): CardTheme {
  return cardThemes[isCardThemeId(id) ? id : DEFAULT_CARD_THEME];
}
