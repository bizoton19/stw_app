import {
  classifyHostPushPermission,
  hostPushPrimeVariant,
  isSameLocalDay,
  localDayKey,
  mayRequestHostPushPermission,
  type HostPushPermission,
} from "./host-push-prime-policy";
import { mayAutoShowHostPrime, type HostPrimeShownAt } from "./host-prime-policy";

export type HostLocationPermission = HostPushPermission;

export const classifyHostLocationPermission = classifyHostPushPermission;
export const hostLocationPrimeVariant = hostPushPrimeVariant;
export const mayRequestHostLocationPermission = mayRequestHostPushPermission;

/** AsyncStorage keys. Separate from the notification sheet. */
export const HOST_LOCATION_PRIME_KEYS = {
  dismissedAt: "hostLocationPrime.dismissedAt",
  lastShownAt: "hostLocationPrime.lastShownAt",
  status: "hostLocationPrime.status",
} as const;

/** Place-step push transition. Show once interactions have settled, about 300–400ms. */
export const HOST_LOCATION_PRIME_SETTLE_MS = 350;

export const HOST_LOCATION_PRIME_COPY = {
  undetermined: {
    title: "Find the place faster",
    body: "See restaurants and bars near you and pick yours in a tap. You can still search by name.",
    primary: "Turn on location",
    secondary: "Not now",
  },
  denied: {
    title: "Location is off",
    body: "To see places near you, turn on location for Split the Wine in Settings. You can still search by name.",
    primary: "Go to Settings",
    secondary: "Not now",
  },
} as const;

export type HostLocationPrimeStatus = {
  permission: HostLocationPermission | null;
};

export function emptyHostLocationPrimeStatus(): HostLocationPrimeStatus {
  return { permission: null };
}

/**
 * In-memory "we already resolved a location ask today" flag.
 * Covers the gap before AsyncStorage writes, and a system prompt opened
 * from the quiet line (that tap does not count as an auto-show).
 */
let resolvedOn: string | null = null;

export function noteHostLocationPrimeResolved(now = new Date()): void {
  const day = localDayKey(now);
  if (day) resolvedOn = day;
}

export function hostLocationPrimeResolvedToday(now = new Date()): boolean {
  const today = localDayKey(now);
  return today != null && resolvedOn === today;
}

export function resetHostLocationPrimeSessionForTests(): void {
  resolvedOn = null;
}

/**
 * Remaining wait so the sheet does not appear during the push transition.
 * Interactions may already have taken part of the 350ms.
 */
export function hostLocationPrimeWaitMs(
  elapsedSinceFocusMs: number,
  settleMs = HOST_LOCATION_PRIME_SETTLE_MS,
): number {
  if (!Number.isFinite(elapsedSinceFocusMs) || elapsedSinceFocusMs < 0) return settleMs;
  return Math.max(0, settleMs - elapsedSinceFocusMs);
}

export function parseHostLocationPrimeStatus(raw: string | null): HostLocationPrimeStatus {
  if (!raw) return emptyHostLocationPrimeStatus();
  try {
    const value = JSON.parse(raw) as Partial<HostLocationPrimeStatus>;
    const permission =
      value.permission === "granted" ||
      value.permission === "denied" ||
      value.permission === "undetermined"
        ? value.permission
        : null;
    return { permission };
  } catch {
    return emptyHostLocationPrimeStatus();
  }
}

/**
 * Once per local calendar day. Granted never auto-shows.
 * Not now today, or an auto-show today, hides it until tomorrow.
 * Denied still qualifies — the sheet uses the Settings variant.
 */
export function shouldPresentHostLocationPrime(input: {
  permission: HostLocationPermission;
  dismissedAt: string | null;
  lastShownAt: string | null;
  now: Date;
}): boolean {
  if (input.permission === "granted") return false;
  if (isSameLocalDay(input.dismissedAt, input.now)) return false;
  if (isSameLocalDay(input.lastShownAt, input.now)) return false;
  return true;
}

/**
 * AppState can report a deny while the system prompt is still up, or while
 * the sheet is already sliding closed. Swapping to "Location is off" then
 * flashes the Settings copy on the way out. A later open still uses the
 * denied variant from storage. Grant-on-return is a separate check.
 */
export function shouldRevealDeniedLocationVariant(input: {
  visible: boolean;
  permission: HostLocationPermission | null;
  variant: "undetermined" | "denied";
  busy: boolean;
  closing: boolean;
}): boolean {
  if (!input.visible || input.permission !== "denied" || input.variant === "denied") return false;
  if (input.busy || input.closing) return false;
  return true;
}

/** Settings return: close as soon as the live permission is granted. */
export function shouldCloseLocationPrimeForGrant(input: {
  visible: boolean;
  permission: HostLocationPermission | null;
}): boolean {
  return input.visible && input.permission === "granted";
}

/** A system-prompt deny should survive a cold restart the same day. */
export function shouldRememberSystemLocationDenial(permission: HostLocationPermission): boolean {
  return permission === "denied";
}

/** Expo web has no app Settings page for this sheet. */
export function hostLocationSheetEnabled(os: string): boolean {
  return os !== "web";
}

/**
 * Auto-show only. The quiet line ignores cadence and this cooldown.
 */
export function shouldAutoShowHostLocationPrime(input: {
  permission: HostLocationPermission;
  dismissedAt: string | null;
  lastShownAt: string | null;
  shownAt: HostPrimeShownAt;
  otherSheetVisible: boolean;
  now: Date;
}): boolean {
  if (hostLocationPrimeResolvedToday(input.now)) return false;
  if (
    !shouldPresentHostLocationPrime({
      permission: input.permission,
      dismissedAt: input.dismissedAt,
      lastShownAt: input.lastShownAt,
      now: input.now,
    })
  ) {
    return false;
  }
  return mayAutoShowHostPrime({
    otherSheetVisible: input.otherSheetVisible,
    shownAt: input.shownAt,
    now: input.now,
  });
}
