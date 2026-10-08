import AsyncStorage from "@react-native-async-storage/async-storage";
import { HOST_LOCATION_PRIME_KEYS } from "@/lib/host-location-prime-policy";
import type { HostPrimeShownAt } from "@/lib/host-prime-policy";
import { HOST_PUSH_PRIME_KEYS } from "@/lib/host-push-prime-policy";

/** Last auto-show timestamps for both sheets. Quiet-line opens do not write these. */
export async function loadHostPrimeShownAt(): Promise<HostPrimeShownAt> {
  const pairs = await AsyncStorage.multiGet([
    HOST_PUSH_PRIME_KEYS.lastShownAt,
    HOST_LOCATION_PRIME_KEYS.lastShownAt,
  ]);
  const map = new Map(pairs);
  return {
    push: map.get(HOST_PUSH_PRIME_KEYS.lastShownAt) ?? null,
    location: map.get(HOST_LOCATION_PRIME_KEYS.lastShownAt) ?? null,
  };
}
