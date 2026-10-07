export type RevealRect = {
  /** Top edge in the same coordinate space as `viewport`. */
  y: number;
  height: number;
};

/**
 * How far to change the scroll offset so `row` sits fully inside `viewport`.
 * Positive moves content up (the row was below the fold).
 */
export function revealScrollDelta(
  row: RevealRect,
  viewport: RevealRect,
  margin = 8,
): number {
  if (viewport.height <= 0 || row.height <= 0) return 0;
  const visibleTop = viewport.y + margin;
  const visibleBottom = viewport.y + viewport.height - margin;
  // A row taller than the open area (keyboard + footer) keeps its top on screen.
  if (row.height >= viewport.height - margin * 2) {
    return row.y - visibleTop;
  }
  const rowBottom = row.y + row.height;
  if (rowBottom > visibleBottom) return rowBottom - visibleBottom;
  if (row.y < visibleTop) return row.y - visibleTop;
  return 0;
}
