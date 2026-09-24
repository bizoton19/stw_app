/**
 * Claim board helpers — keep mobile + web pick/qty behavior aligned.
 */

/** True when at least one selected line still has more than one unit left. */
export function needsQtyStep(
  remaining: Record<string, number>,
  queuedItemIds: string[],
): boolean {
  return queuedItemIds.some((id) => (remaining[id] ?? 0) > 1);
}

/** Drop gone lines and clamp units to what’s still available. */
export function pruneQueue(
  remaining: Record<string, number>,
  queued: string[],
  units: Record<string, number>,
): { queued: string[]; units: Record<string, number> } {
  const nextQueued = queued.filter((id) => (remaining[id] ?? 0) > 0);
  const nextUnits: Record<string, number> = {};
  for (const id of nextQueued) {
    const max = remaining[id] ?? 0;
    const want = units[id] ?? 1;
    nextUnits[id] = Math.min(Math.max(1, want), max);
  }
  return { queued: nextQueued, units: nextUnits };
}
