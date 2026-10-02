/**
 * Guest identity contract — see docs/guest-id-contract.md.
 * `guestId` is who someone is. `name` / `personName` is a cosmetic label.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Web localStorage and Expo AsyncStorage key prefix. Full key: `stw-guest:{receiptId}`. */
export const GUEST_STORAGE_PREFIX = "stw-guest:";

export function guestStorageKey(receiptId: string): string {
  return `${GUEST_STORAGE_PREFIX}${receiptId}`;
}

export function isGuestId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Canonical lowercase UUID, or undefined when the client omitted it (legacy). */
export function normalizeGuestId(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (!isGuestId(value)) {
    throw Object.assign(new Error("invalid_guest_id"), {
      code: "invalid",
      message: "guestId must be a UUID",
    });
  }
  return value.trim().toLowerCase();
}

export function newGuestId(): string {
  return crypto.randomUUID();
}

export type StoredGuest = {
  guestId?: string;
  name: string;
  contact: string;
};

/** Parse a `stw-guest:{receiptId}` JSON value. Invalid guestIds are dropped. */
export function parseStoredGuest(raw: string | null | undefined): StoredGuest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as {
      guestId?: unknown;
      name?: unknown;
      contact?: unknown;
    };
    if (typeof value.name !== "string" || !value.name.trim()) return null;
    const guestId = isGuestId(value.guestId) ? value.guestId.trim().toLowerCase() : undefined;
    return {
      guestId,
      name: value.name.trim(),
      contact: typeof value.contact === "string" ? value.contact.trim() : "",
    };
  } catch {
    return null;
  }
}

export function mergeGuestIdentity(
  previous: StoredGuest | null,
  input: { guestId?: string; name: string; contact?: string },
): { guestId: string; name: string; contact: string } {
  const name = input.name.trim();
  if (!name) {
    throw Object.assign(new Error("name_required"), { code: "invalid" });
  }
  const requested = isGuestId(input.guestId) ? input.guestId.trim().toLowerCase() : undefined;
  const previousId = isGuestId(previous?.guestId) ? previous.guestId.trim().toLowerCase() : undefined;
  return {
    guestId: requested ?? previousId ?? newGuestId(),
    name,
    contact: (input.contact ?? previous?.contact ?? "").trim(),
  };
}

export function claimPersonFields(input: {
  guestId?: unknown;
  personName: string;
  personContact?: string | null;
}): { guestId?: string; personName: string; personContact?: string } {
  const personName = input.personName.trim();
  if (!personName) {
    throw Object.assign(new Error("name_required"), { code: "invalid" });
  }
  const contact = typeof input.personContact === "string" ? input.personContact.trim() : "";
  return {
    guestId: normalizeGuestId(input.guestId),
    personName,
    personContact: contact || undefined,
  };
}

export function relabelGuestClaims<
  T extends {
    guestId?: string;
    personName: string;
    personContact?: string;
    autoLeftover?: boolean;
  },
>(claims: T[], guestId: string, personName: string, personContact?: string) {
  for (const claim of claims) {
    if (claim.autoLeftover || claim.guestId !== guestId) continue;
    claim.personName = personName;
    claim.personContact = personContact;
  }
}
