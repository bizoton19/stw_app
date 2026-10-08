import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HOST_LOCATION_PRIME_KEYS,
  parseHostLocationPrimeStatus,
  type HostLocationPermission,
  type HostLocationPrimeStatus,
} from "@/lib/host-location-prime-policy";

export type HostLocationPrimeRecord = {
  dismissedAt: string | null;
  lastShownAt: string | null;
  status: HostLocationPrimeStatus;
};

export async function loadHostLocationPrime(): Promise<HostLocationPrimeRecord> {
  const pairs = await AsyncStorage.multiGet([
    HOST_LOCATION_PRIME_KEYS.dismissedAt,
    HOST_LOCATION_PRIME_KEYS.lastShownAt,
    HOST_LOCATION_PRIME_KEYS.status,
  ]);
  const map = new Map(pairs);
  return {
    dismissedAt: map.get(HOST_LOCATION_PRIME_KEYS.dismissedAt) ?? null,
    lastShownAt: map.get(HOST_LOCATION_PRIME_KEYS.lastShownAt) ?? null,
    status: parseHostLocationPrimeStatus(map.get(HOST_LOCATION_PRIME_KEYS.status) ?? null),
  };
}

/** Auto-show only. A quiet-line open does not call this, so it does not spend the daily slot. */
export async function markHostLocationPrimeShown(
  permission: Exclude<HostLocationPermission, "granted">,
  now = new Date(),
): Promise<void> {
  await AsyncStorage.multiSet([
    [HOST_LOCATION_PRIME_KEYS.lastShownAt, now.toISOString()],
    [HOST_LOCATION_PRIME_KEYS.status, JSON.stringify({ permission } satisfies HostLocationPrimeStatus)],
  ]);
}

/** Not now, scrim, swipe-down, and hardware back share this path. */
export async function markHostLocationPrimeDismissed(now = new Date()): Promise<void> {
  await AsyncStorage.setItem(HOST_LOCATION_PRIME_KEYS.dismissedAt, now.toISOString());
}

export async function markHostLocationPrimeOutcome(
  permission: HostLocationPermission,
): Promise<void> {
  const current = await loadHostLocationPrime();
  const status: HostLocationPrimeStatus = { ...current.status, permission };
  await AsyncStorage.setItem(HOST_LOCATION_PRIME_KEYS.status, JSON.stringify(status));
}
