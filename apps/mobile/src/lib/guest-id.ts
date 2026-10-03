/**
 * Stable guest identity for claim aggregation.
 * Keep in sync with `src/lib/guest-id.ts`.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isGuestId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim().toLowerCase());
}

export function createGuestId(): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoObj?.getRandomValues === "function") cryptoObj.getRandomValues(bytes);
  else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function resolveGuestId(incoming?: string | null, existing?: string | null): string {
  if (isGuestId(incoming)) return incoming.trim().toLowerCase();
  if (isGuestId(existing)) return existing.trim().toLowerCase();
  return createGuestId();
}

export function sameGuest(
  person: { guestId?: string | null } | null | undefined,
  guest: { guestId?: string | null } | null | undefined,
): boolean {
  if (!isGuestId(person?.guestId) || !isGuestId(guest?.guestId)) return false;
  return person.guestId.trim().toLowerCase() === guest.guestId.trim().toLowerCase();
}

export function personRowKey(person: { guestId?: string | null; personName: string }): string {
  if (isGuestId(person.guestId)) return `id:${person.guestId.trim().toLowerCase()}`;
  return `name:${person.personName.trim().toLowerCase()}`;
}

export function findMine<T extends { guestId?: string | null }>(
  people: readonly T[],
  guest: { guestId?: string | null } | null | undefined,
): T | undefined {
  if (!isGuestId(guest?.guestId)) return undefined;
  return people.find((person) => sameGuest(person, guest));
}
