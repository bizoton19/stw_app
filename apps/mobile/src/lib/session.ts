import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GuestIdentity } from "./types";

const HOST_PREFIX = "stw-host:";
const GUEST_PREFIX = "stw-guest:";
const TOKEN_PREFIX = "stw-tokens:";

const host = new Map<string, string>();
const guests = new Map<string, GuestIdentity>();
const tokens = new Map<string, Record<string, string>>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

async function persistHost(id: string, token: string) {
  host.set(id, token);
  await AsyncStorage.setItem(`${HOST_PREFIX}${id}`, token);
}

async function persistGuest(id: string, guest: GuestIdentity) {
  guests.set(id, guest);
  await AsyncStorage.setItem(`${GUEST_PREFIX}${id}`, JSON.stringify(guest));
}

async function persistTokens(id: string, map: Record<string, string>) {
  tokens.set(id, map);
  await AsyncStorage.setItem(`${TOKEN_PREFIX}${id}`, JSON.stringify(map));
}

export async function hydrateSession() {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet([...keys]);
    for (const [key, value] of pairs) {
      if (!value) continue;
      if (key.startsWith(HOST_PREFIX)) host.set(key.slice(HOST_PREFIX.length), value);
      else if (key.startsWith(GUEST_PREFIX)) {
        try {
          guests.set(key.slice(GUEST_PREFIX.length), JSON.parse(value) as GuestIdentity);
        } catch {
          /* ignore */
        }
      } else if (key.startsWith(TOKEN_PREFIX)) {
        try {
          tokens.set(key.slice(TOKEN_PREFIX.length), JSON.parse(value) as Record<string, string>);
        } catch {
          /* ignore */
        }
      }
    }
    hydrated = true;
  })();
  return hydratePromise;
}

export async function saveHostToken(receiptId: string, token: string) {
  await persistHost(receiptId, token);
}

export function getHostToken(receiptId: string): string | null {
  return host.get(receiptId) ?? null;
}

export async function ensureDemoHost(isHostQuery: boolean) {
  if (isHostQuery) await persistHost("demo", "demo-host");
}

export async function saveGuest(receiptId: string, guest: GuestIdentity) {
  await persistGuest(receiptId, guest);
}

export function getGuest(receiptId: string): GuestIdentity | null {
  return guests.get(receiptId) ?? null;
}

export async function saveClaimToken(receiptId: string, claimId: string, token: string) {
  const current = { ...(tokens.get(receiptId) ?? {}) };
  current[claimId] = token;
  await persistTokens(receiptId, current);
}

export function getClaimToken(receiptId: string, claimId: string): string | null {
  return tokens.get(receiptId)?.[claimId] ?? null;
}
