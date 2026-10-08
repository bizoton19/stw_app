import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueueHostPrime } from "@/lib/host-prime-queue";
import {
  HOST_PUSH_PRIME_KEYS,
  localDayKey,
  parseHostPushPrimeStatus,
  type HostPushPermission,
  type HostPushPrimeStatus,
  type HostPushPrimeTrigger,
} from "@/lib/host-push-prime-policy";

export type HostPushPrimeRecord = {
  dismissedAt: string | null;
  lastShownAt: string | null;
  status: HostPushPrimeStatus;
};

/**
 * Same queue as location priming, so a notification sheet and a location
 * sheet cannot present on top of each other.
 */
export function enqueueHostPushPrime<T>(task: () => Promise<T>): Promise<T> {
  return enqueueHostPrime(task);
}

export async function loadHostPushPrime(): Promise<HostPushPrimeRecord> {
  const pairs = await AsyncStorage.multiGet([
    HOST_PUSH_PRIME_KEYS.dismissedAt,
    HOST_PUSH_PRIME_KEYS.lastShownAt,
    HOST_PUSH_PRIME_KEYS.status,
  ]);
  const map = new Map(pairs);
  return {
    dismissedAt: map.get(HOST_PUSH_PRIME_KEYS.dismissedAt) ?? null,
    lastShownAt: map.get(HOST_PUSH_PRIME_KEYS.lastShownAt) ?? null,
    status: parseHostPushPrimeStatus(map.get(HOST_PUSH_PRIME_KEYS.status) ?? null),
  };
}

async function writeStatus(status: HostPushPrimeStatus, extra?: [string, string][]) {
  const rows: [string, string][] = [
    [HOST_PUSH_PRIME_KEYS.status, JSON.stringify(status)],
    ...(extra ?? []),
  ];
  await AsyncStorage.multiSet(rows);
}

export async function markHostPushPrimeShown(
  trigger: HostPushPrimeTrigger,
  permission: Exclude<HostPushPermission, "granted">,
  now = new Date(),
): Promise<void> {
  const current = await loadHostPushPrime();
  const today = localDayKey(now);
  const families =
    current.status.shownOn === today ? [...current.status.shownFamilies] : [];
  if (!families.includes(trigger)) families.push(trigger);
  await writeStatus(
    {
      permission,
      tokenRegistered: false,
      shownOn: today,
      shownFamilies: families,
    },
    [[HOST_PUSH_PRIME_KEYS.lastShownAt, now.toISOString()]],
  );
}

/** Not now, scrim, swipe-down, and hardware back share this path. */
export async function markHostPushPrimeDismissed(now = new Date()): Promise<void> {
  await AsyncStorage.setItem(HOST_PUSH_PRIME_KEYS.dismissedAt, now.toISOString());
}

export async function markHostPushPrimeOutcome(
  permission: HostPushPermission,
  tokenRegistered: boolean,
): Promise<void> {
  const current = await loadHostPushPrime();
  await writeStatus({
    ...current.status,
    permission,
    tokenRegistered: permission === "granted" ? tokenRegistered : false,
    ...(permission === "granted" && tokenRegistered
      ? { shownFamilies: [] as HostPushPrimeTrigger[] }
      : {}),
  });
}
