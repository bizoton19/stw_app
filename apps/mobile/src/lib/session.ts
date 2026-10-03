import AsyncStorage from "@react-native-async-storage/async-storage";
import { isGuestId, resolveGuestId } from "./guest-id";
import type { GuestDraft, GuestIdentity } from "./types";

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

function coerceGuest(id: string, input: GuestDraft): GuestIdentity {
  const existing = guests.get(id);
  return {
    guestId: resolveGuestId(input.guestId, existing?.guestId),
    name: input.name.trim(),
    contact: (input.contact ?? "").trim(),
  };
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
          const receiptId = key.slice(GUEST_PREFIX.length);
          if (guests.has(receiptId)) continue;
          const parsed = JSON.parse(value) as { guestId?: string; name?: string; contact?: string };
          if (typeof parsed.name !== "string" || !parsed.name.trim()) continue;
          const next = coerceGuest(receiptId, {
            guestId: parsed.guestId,
            name: parsed.name,
            contact: typeof parsed.contact === "string" ? parsed.contact : "",
          });
          guests.set(receiptId, next);
          if (!isGuestId(parsed.guestId)) {
            await AsyncStorage.setItem(key, JSON.stringify(next));
          }
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

export async function clearHostToken(receiptId: string) {
  host.delete(receiptId);
  await AsyncStorage.removeItem(`${HOST_PREFIX}${receiptId}`);
}

export async function ensureDemoHost(isHostQuery: boolean) {
  if (isHostQuery) await persistHost("demo", "demo-host");
}

export async function saveGuest(receiptId: string, guest: GuestDraft): Promise<GuestIdentity> {
  const next = coerceGuest(receiptId, guest);
  await persistGuest(receiptId, next);
  return next;
}

export function getGuest(receiptId: string): GuestIdentity | null {
  const existing = guests.get(receiptId);
  if (!existing) return null;
  if (isGuestId(existing.guestId)) return existing;
  const next = coerceGuest(receiptId, existing);
  void persistGuest(receiptId, next);
  return next;
}

export function getClaimTokens(receiptId: string): Record<string, string> {
  return { ...(tokens.get(receiptId) ?? {}) };
}

export async function saveClaimToken(receiptId: string, claimId: string, token: string) {
  const current = { ...(tokens.get(receiptId) ?? {}) };
  current[claimId] = token;
  await persistTokens(receiptId, current);
}

export function getClaimToken(receiptId: string, claimId: string): string | null {
  return tokens.get(receiptId)?.[claimId] ?? null;
}

export async function clearClaimToken(receiptId: string, claimId: string) {
  const current = { ...(tokens.get(receiptId) ?? {}) };
  if (!(claimId in current)) return;
  delete current[claimId];
  await persistTokens(receiptId, current);
}
