/** Shared cadence for host priming sheets (notifications and location). */

export const HOST_PRIME_COOLDOWN_MS = 10 * 60 * 1000;

export type HostPrimeShownAt = {
  push: string | null;
  location: string | null;
};

/**
 * True when `lastShownAt` falls inside the shared auto-show window.
 * The window is exclusive at exactly 10 minutes: that sheet may show again.
 * A timestamp still in the future (clock skew) stays inside the window.
 */
export function isWithinHostPrimeCooldown(
  lastShownAt: string | null,
  now: Date,
  windowMs = HOST_PRIME_COOLDOWN_MS,
): boolean {
  if (!lastShownAt) return false;
  const then = Date.parse(lastShownAt);
  if (Number.isNaN(then)) return false;
  return now.getTime() - then < windowMs;
}

/** Either priming sheet auto-showed inside the shared window. */
export function hostPrimeCooldownActive(
  shownAt: HostPrimeShownAt,
  now: Date,
  windowMs = HOST_PRIME_COOLDOWN_MS,
): boolean {
  return (
    isWithinHostPrimeCooldown(shownAt.push, now, windowMs) ||
    isWithinHostPrimeCooldown(shownAt.location, now, windowMs)
  );
}

/**
 * Auto-show gate shared by both sheets.
 * A quiet-line tap does not call this.
 */
export function mayAutoShowHostPrime(input: {
  otherSheetVisible: boolean;
  shownAt: HostPrimeShownAt;
  now: Date;
}): boolean {
  if (input.otherSheetVisible) return false;
  if (hostPrimeCooldownActive(input.shownAt, input.now)) return false;
  return true;
}
