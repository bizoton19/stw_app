export const PLACE_CARD_HEIGHT = 220;
/** Minimum caption band: about the bottom 45% of the card. It grows with the type. */
export const PLACE_CAPTION_MIN_HEIGHT = Math.round(PLACE_CARD_HEIGHT * 0.45);
export const STEM_MOTIF_SIZE = 72;
/** Largest iOS type size that still keeps the first name line inside the card. */
export const CAPTION_FONT_SCALE_MAX = 2;
/** Fixed ramp above the solid caption plateau. */
export const CAPTION_RAMP_PX = 36;
/** photoScrim alpha on the plateau and at the bottom of the ramp. */
export const CAPTION_SCRIM_ALPHA = 0.78;

/**
 * The no-photo stem sits in the image area above the caption. Once the band
 * grows into that stem (about 1.35× with a three-line name), the name would
 * sit on merlot. Hide the motif then; otherwise shift it up with the band.
 */
export function stemClearsCaption(captionHeight: number): boolean {
  return PLACE_CARD_HEIGHT - captionHeight >= STEM_MOTIF_SIZE;
}

export type CaptionScrimOverlay = {
  /** Solid fill behind every caption line. Grows with the band. */
  plateau: { color: string; alpha: number };
  /** Stable ramp above the plateau. Alpha 0 at the top, plateau alpha at the bottom. */
  ramp: { height: number; fromAlpha: number; toAlpha: number; color: string };
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Scrim color at `alpha`. Used as a View background, not a CSS gradient. */
export function scrimRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Plateau plus ramp. The plateau is an absolutely positioned View. The ramp is
 * a react-native-svg LinearGradient of fixed height. Neither uses
 * `experimental_backgroundImage`.
 */
export function captionScrimOverlay(scrimHex: string): CaptionScrimOverlay {
  return {
    plateau: {
      color: scrimRgba(scrimHex, CAPTION_SCRIM_ALPHA),
      alpha: CAPTION_SCRIM_ALPHA,
    },
    ramp: {
      height: CAPTION_RAMP_PX,
      fromAlpha: 0,
      toAlpha: CAPTION_SCRIM_ALPHA,
      color: scrimHex,
    },
  };
}

function srgbChannel(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

/** WCAG contrast of two opaque hex colors. */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** 8-bit composite of a scrim at `alpha` over an opaque photo. */
export function compositeHex(scrimHex: string, alpha: number, photoHex: string): string {
  const scrim = hexToRgb(scrimHex);
  const photo = hexToRgb(photoHex);
  const mix = (fg: number, bg: number) => Math.round(fg * alpha + bg * (1 - alpha));
  const channels = [mix(scrim.r, photo.r), mix(scrim.g, photo.g), mix(scrim.b, photo.b)];
  return `#${channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Worst case for caption type: paper ink on the 0.78 plateau over a pure-white
 * photo. Text starts below the ramp, so the ramp's lighter stops are not behind it.
 */
export function worstCaseCaptionContrast(textHex: string, scrimHex: string): number {
  const background = compositeHex(scrimHex, CAPTION_SCRIM_ALPHA, "#ffffff");
  return contrastRatio(textHex, background);
}
