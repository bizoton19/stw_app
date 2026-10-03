import { cardThemes } from "@/lib/card-theme/themes";

/**
 * The day palette, and the only palette most of the app sees.
 *
 * Roughly 250 of these references are baked into module-scope `StyleSheet.create`
 * objects, which are evaluated once at import — so this export cannot follow the
 * clock. Dusk on native is therefore opt-in per component via `useCardTheme()`
 * (see `card-theme/dusk.ts`); screens that want it must read tokens at render
 * time. `linen` holds the shipped values, so nothing moved by pointing here.
 */
export const colors = cardThemes.linen;

export const space = {
  hairline: 1,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const type = {
  kicker: 13,
  body: 15,
  small: 12,
  title: 28,
  step: 12,
};
