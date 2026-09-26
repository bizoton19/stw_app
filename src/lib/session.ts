const HOST_PREFIX = "stw-host:";
const GUEST_PREFIX = "stw-guest:";
const TOKEN_PREFIX = "stw-tokens:";

export function saveHostToken(receiptId: string, token: string) {
  sessionStorage.setItem(`${HOST_PREFIX}${receiptId}`, token);
}

export function getHostToken(receiptId: string): string | null {
  return sessionStorage.getItem(`${HOST_PREFIX}${receiptId}`);
}

export function ensureDemoHost(isHostQuery: boolean) {
  if (isHostQuery) saveHostToken("demo", "demo-host");
}

export type GuestIdentity = { name: string; contact: string };

export function saveGuest(receiptId: string, guest: GuestIdentity) {
  sessionStorage.setItem(`${GUEST_PREFIX}${receiptId}`, JSON.stringify(guest));
}

export function getGuest(receiptId: string): GuestIdentity | null {
  const raw = sessionStorage.getItem(`${GUEST_PREFIX}${receiptId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestIdentity;
  } catch {
    return null;
  }
}

export function saveClaimToken(receiptId: string, claimId: string, token: string) {
  const key = `${TOKEN_PREFIX}${receiptId}`;
  const current = readTokens(receiptId);
  current[claimId] = token;
  sessionStorage.setItem(key, JSON.stringify(current));
}

export function getClaimToken(receiptId: string, claimId: string): string | null {
  return readTokens(receiptId)[claimId] ?? null;
}

export function clearClaimToken(receiptId: string, claimId: string) {
  const key = `${TOKEN_PREFIX}${receiptId}`;
  const current = readTokens(receiptId);
  if (!(claimId in current)) return;
  delete current[claimId];
  sessionStorage.setItem(key, JSON.stringify(current));
}

function readTokens(receiptId: string): Record<string, string> {
  const raw = sessionStorage.getItem(`${TOKEN_PREFIX}${receiptId}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { hostToken?: string | null; claimToken?: string | null },
): Promise<T> {
  const { hostToken, claimToken, headers: initHeaders, ...rest } = init ?? {};
  const headers = new Headers(initHeaders);
  if (hostToken) headers.set("x-host-token", hostToken);
  if (claimToken) headers.set("x-claim-token", claimToken);
  if (rest.body && !(rest.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...rest, headers });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    remaining?: number;
    itemId?: string;
    itemName?: string;
    claimedBy?: string;
    existingId?: string;
    message?: string;
  };
  if (!res.ok) {
    const err = new Error(data.message || data.error || "request_failed") as Error & {
      code?: string;
      remaining?: number;
      itemId?: string;
      itemName?: string;
      claimedBy?: string;
      existingId?: string;
      status: number;
    };
    err.code = data.error;
    err.remaining = data.remaining;
    err.itemId = data.itemId;
    err.itemName = data.itemName;
    err.claimedBy = data.claimedBy;
    err.existingId = data.existingId;
    err.status = res.status;
    throw err;
  }
  return data;
}
