/** AsyncStorage keys for the host notification priming sheet. */
export const HOST_PUSH_PRIME_KEYS = {
  dismissedAt: "hostPushPrime.dismissedAt",
  lastShownAt: "hostPushPrime.lastShownAt",
  status: "hostPushPrime.status",
} as const;

export type HostPushPermission = "granted" | "denied" | "undetermined";

/** Host moments that can present the sheet. Earliest in a session wins. */
export type HostPushPrimeTrigger = "create-outing" | "share-claim" | "live-board";

export type HostPushPrimeStatus = {
  permission: HostPushPermission | null;
  tokenRegistered: boolean;
  /** Local calendar day (YYYY-MM-DD) the sheet was last presented. */
  shownOn: string | null;
  shownFamilies: HostPushPrimeTrigger[];
};

export const HOST_PUSH_PRIME_COPY = {
  undetermined: {
    title: "Stay in the loop",
    body: "Get a ping when someone RSVPs or claims a dish. You can change this later in Settings.",
    primary: "Turn on alerts",
    secondary: "Not now",
  },
  denied: {
    title: "Alerts are off",
    body: "To hear about RSVPs and claims, turn on notifications for Split the Wine in Settings.",
    primary: "Go to Settings",
    secondary: "Not now",
  },
} as const;

const TRIGGERS: readonly HostPushPrimeTrigger[] = ["create-outing", "share-claim", "live-board"];

export function emptyHostPushPrimeStatus(): HostPushPrimeStatus {
  return {
    permission: null,
    tokenRegistered: false,
    shownOn: null,
    shownFamilies: [],
  };
}

export function localDayKey(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isSameLocalDay(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const key = localDayKey(new Date(iso));
  const today = localDayKey(now);
  return key != null && today != null && key === today;
}

/**
 * OS permission → sheet variant.
 * `canAskAgain === false` means the system dialog is dead (Settings only).
 */
export function classifyHostPushPermission(input: {
  status: string;
  canAskAgain?: boolean;
}): HostPushPermission {
  if (input.status === "granted") return "granted";
  if (input.status === "denied" || input.canAskAgain === false) return "denied";
  return "undetermined";
}

/** The system prompt is only callable from the undetermined sheet. */
export function mayRequestHostPushPermission(permission: HostPushPermission): boolean {
  return permission === "undetermined";
}

export function hostPushPrimeVariant(
  live: HostPushPermission,
  remembered: HostPushPermission | null,
): "undetermined" | "denied" {
  if (live === "denied" || remembered === "denied") return "denied";
  return "undetermined";
}

export function parseHostPushPrimeStatus(raw: string | null): HostPushPrimeStatus {
  if (!raw) return emptyHostPushPrimeStatus();
  try {
    const value = JSON.parse(raw) as Partial<HostPushPrimeStatus>;
    const permission =
      value.permission === "granted" ||
      value.permission === "denied" ||
      value.permission === "undetermined"
        ? value.permission
        : null;
    const shownFamilies = Array.isArray(value.shownFamilies)
      ? value.shownFamilies.filter((item): item is HostPushPrimeTrigger =>
          TRIGGERS.includes(item as HostPushPrimeTrigger),
        )
      : [];
    return {
      permission,
      tokenRegistered: value.tokenRegistered === true,
      shownOn: typeof value.shownOn === "string" ? value.shownOn : null,
      shownFamilies,
    };
  } catch {
    return emptyHostPushPrimeStatus();
  }
}

/**
 * Once per local calendar day, and at most once per trigger family that day.
 * Granted permission never shows the sheet (token registration is silent).
 * Not now (`dismissedAt` today) hides every family until the next day.
 */
export function shouldPresentHostPushPrime(input: {
  permission: HostPushPermission;
  dismissedAt: string | null;
  lastShownAt: string | null;
  status: HostPushPrimeStatus;
  trigger: HostPushPrimeTrigger;
  now: Date;
}): boolean {
  if (input.permission === "granted") return false;
  if (isSameLocalDay(input.dismissedAt, input.now)) return false;
  if (isSameLocalDay(input.lastShownAt, input.now)) return false;
  const today = localDayKey(input.now);
  if (
    today &&
    input.status.shownOn === today &&
    input.status.shownFamilies.includes(input.trigger)
  ) {
    return false;
  }
  return true;
}
