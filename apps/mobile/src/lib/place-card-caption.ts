export const PLACE_CARD_HEIGHT = 220;
/** Minimum caption band: about the bottom 45% of the card. It grows with the type. */
export const PLACE_CAPTION_MIN_HEIGHT = Math.round(PLACE_CARD_HEIGHT * 0.45);
export const STEM_MOTIF_SIZE = 72;
/** Largest iOS type size that still keeps the first name line inside the card. */
export const CAPTION_FONT_SCALE_MAX = 2;

/**
 * The no-photo stem sits in the image area above the caption. Once the band
 * grows into that stem (about 1.35× with a three-line name), the name would
 * sit on merlot. Hide the motif then; otherwise shift it up with the band.
 */
export function stemClearsCaption(captionHeight: number): boolean {
  return PLACE_CARD_HEIGHT - captionHeight >= STEM_MOTIF_SIZE;
}
