/**
 * A stepper end at its limit. `chromeBorder` is the outline; `inkFirm` is the
 * glyph. The ring is a hairline so it does not read stronger than the enabled
 * stroke.
 */
export function stepperLimitPaint(atLimit: boolean): {
  outline: "chromeBorder" | "border";
  glyph: "inkFirm" | "ink";
  hairline: boolean;
} {
  if (atLimit) return { outline: "chromeBorder", glyph: "inkFirm", hairline: true };
  return { outline: "border", glyph: "ink", hairline: false };
}
