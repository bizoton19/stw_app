import { cardThemes } from "@/lib/card-theme/themes";

/**
 * Legacy linen-only palette for module-scope `StyleSheet.create` call sites.
 *
 * This export does **not** follow dusk. New and migrated components must use
 * `useCardTheme()` + render-time styles (see `card-theme/dusk.ts`).
 * Token source of truth: `design-tokens/card-theme.json` → `npm run theme:generate`.
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
