import { useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  cardThemes,
  DEFAULT_CARD_THEME,
  type CardTheme,
  type CardThemeId,
} from "./themes";

/**
 * Mirrors `src/lib/card-theme/dusk.ts`. 19:00 was chosen over 18:00 so a 18:30
 * dinner doesn't open already dimmed.
 */
export const DUSK_HOUR = 19;
export const DAWN_HOUR = 6;

export function duskTheme(now: Date = new Date()): CardThemeId {
  const hour = now.getHours();
  // A nonsense device clock falls back to the approved default.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return DEFAULT_CARD_THEME;
  return hour >= DUSK_HOUR || hour < DAWN_HOUR ? "candlelight" : "linen";
}

/**
 * Native has no SSR, so the theme is computed at mount and re-checked when the app
 * returns to the foreground. No timer polling: nobody's dinner crosses 19:00 and
 * needs a live repaint mid-tap.
 */
export function useCardTheme(): CardTheme {
  const [id, setId] = useState<CardThemeId>(() => duskTheme());

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setId(duskTheme());
    });
    return () => sub.remove();
  }, []);

  return cardThemes[id];
}
