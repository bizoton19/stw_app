import { randomUUID } from "node:crypto";
import { isValidatedVenue, findVenueDayConflict, receiptDayKey } from "./venue-day";
import type {
  HostInfo,
  Invitee,
  InviteeResponse,
  Receipt,
  ReceiptVenue,
} from "./types";

function shortId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10);
}

export type PlanCreateInput = {
  venue: ReceiptVenue;
  nightAt: string;
  /** Host's intended calendar day (YYYY-MM-DD). Prefer over UTC slice of nightAt. */
  receiptDate?: string | null;
  expectedPartySize?: number | null;
  hostInfo?: HostInfo | null;
  note?: string | null;
};

/** Validate + normalize host plan payload. Throws { code }. */
export function normalizePlanInput(input: PlanCreateInput): {
  venue: ReceiptVenue;
  restaurant: string;
  nightAt: string;
  receiptDate: string;
  expectedPartySize: number | null;
  hostInfo: HostInfo | undefined;
} {
  if (!isValidatedVenue(input.venue)) {
    throw Object.assign(new Error("venue_required"), {
      code: "invalid",
      message: "Pick a place from suggestions.",
    });
  }
  const night = new Date(input.nightAt);
  if (Number.isNaN(night.getTime())) {
    throw Object.assign(new Error("invalid_night"), {
      code: "invalid",
      message: "Choose when you’re going out.",
    });
  }
  const nightAt = night.toISOString();
  const explicitDay =
    typeof input.receiptDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.receiptDate.trim())
      ? input.receiptDate.trim()
      : null;
  const receiptDate =
    explicitDay ??
    receiptDayKey({
      receiptDate: nightAt.slice(0, 10),
      createdAt: nightAt,
    });
  const restaurant = input.venue.name.trim();
  let expectedPartySize: number | null = null;
  if (input.expectedPartySize != null) {
    const n = Math.floor(Number(input.expectedPartySize));
    if (n >= 2 && n <= 40) expectedPartySize = n;
  }
  let hostInfo: HostInfo | undefined;
  const noteFromInput =
    input.hostInfo?.note?.trim() || input.note?.trim() || undefined;
  const reach = input.hostInfo?.reach ?? undefined;
  const payments = input.hostInfo?.payments ?? [];
  if (payments.length || noteFromInput || reach) {
    hostInfo = {
      payments,
      ...(noteFromInput ? { note: noteFromInput } : {}),
      ...(reach ? { reach } : {}),
    };
  }
  return {
    venue: input.venue,
    restaurant,
    nightAt,
    receiptDate,
    expectedPartySize,
    hostInfo,
  };
}

/** Calendar day for the outing (YYYY-MM-DD). */
export function outingDayKey(
  receipt: Pick<Receipt, "receiptDate" | "nightAt" | "createdAt">,
): string | null {
  if (receipt.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receipt.receiptDate)) {
    return receipt.receiptDate;
  }
  if (receipt.nightAt) {
    const d = new Date(receipt.nightAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** True when the outing's calendar day is today or already past (local `now`). */
export function isOutingDayReached(
  receipt: Pick<Receipt, "receiptDate" | "nightAt" | "createdAt">,
  now: Date = new Date(),
): boolean {
  const day = outingDayKey(receipt);
  if (!day) return false;
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return day <= today;
}

/**
 * On the outing day, planning tabs become draft so the host can upload the check.
 * Mutates receipt in place; returns true if status changed.
 */
export function promotePlanningToDraftIfDue(
  receipt: Pick<Receipt, "status" | "receiptDate" | "nightAt" | "createdAt">,
  now: Date = new Date(),
): boolean {
  if (receipt.status !== "planning") return false;
  if (!isOutingDayReached(receipt, now)) return false;
  receipt.status = "draft";
  return true;
}

export function newInvitee(input: {
  personName: string;
  personContact?: string | null;
  response?: InviteeResponse;
  note?: string | null;
}): Invitee {
  const personName = input.personName.trim();
  if (!personName) {
    throw Object.assign(new Error("name_required"), { code: "invalid" });
  }
  const now = new Date().toISOString();
  return {
    id: `inv_${shortId()}`,
    personName,
    personContact: input.personContact?.trim() || null,
    inviteToken: randomUUID().replace(/-/g, ""),
    response: input.response ?? "going",
    note: input.note?.trim() || null,
    inviteSentAt: null,
    updatedAt: now,
  };
}

/**
 * Public board: only people who RSVP’d (going / maybe / can’t).
 * No invite tokens or contacts.
 */
export function publicInvitees(
  invitees: Invitee[] | undefined,
  _inviteToken?: string | null,
): Invitee[] {
  if (!invitees?.length) return [];
  return invitees
    .filter(
      (row) =>
        row.response === "going" || row.response === "maybe" || row.response === "cant",
    )
    .map((row) => ({
      id: row.id,
      personName: row.personName,
      personContact: null,
      inviteToken: "",
      response: row.response,
      note: row.note ?? null,
      inviteSentAt: null,
      updatedAt: row.updatedAt,
    }));
}

/** Host board: same RSVP roster (notes visible; no unused Invited rows). */
export function hostInvitees(invitees: Invitee[] | undefined): Invitee[] {
  return publicInvitees(invitees);
}

function normalizeNote(note?: string | null): string | null {
  if (note == null) return null;
  const t = note.trim();
  return t ? t.slice(0, 280) : null;
}

export function applyRsvp(
  invitees: Invitee[] | undefined,
  input: {
    response: Exclude<InviteeResponse, "invited">;
    personName?: string;
    personContact?: string | null;
    inviteToken?: string | null;
    note?: string | null;
  },
): Invitee[] {
  const response = input.response;
  if (response !== "going" && response !== "maybe" && response !== "cant") {
    throw Object.assign(new Error("invalid_response"), { code: "invalid" });
  }
  const list = invitees ? [...invitees] : [];
  const now = new Date().toISOString();
  const token = input.inviteToken?.trim();
  const note = normalizeNote(input.note);
  const noteProvided = input.note !== undefined;

  if (token) {
    const idx = list.findIndex((row) => row.inviteToken === token);
    if (idx < 0) {
      throw Object.assign(new Error("invite_not_found"), { code: "not_found" });
    }
    const prev = list[idx];
    list[idx] = {
      ...prev,
      personName: input.personName?.trim() || prev.personName,
      personContact: input.personContact?.trim() || prev.personContact || null,
      response,
      note: noteProvided ? note : prev.note ?? null,
      updatedAt: now,
    };
    return list;
  }

  const name = input.personName?.trim();
  if (!name) {
    throw Object.assign(new Error("name_required"), { code: "invalid" });
  }
  const existing = list.findIndex(
    (row) => row.personName.toLowerCase() === name.toLowerCase(),
  );
  if (existing >= 0) {
    const prev = list[existing];
    list[existing] = {
      ...prev,
      personContact: input.personContact?.trim() || prev.personContact || null,
      response,
      note: noteProvided ? note : prev.note ?? null,
      updatedAt: now,
    };
    return list;
  }
  list.push(
    newInvitee({
      personName: name,
      personContact: input.personContact,
      response,
      note,
    }),
  );
  return list;
}

/** Statuses that may receive a receipt photo parse. */
export function canParseStatus(status: Receipt["status"]): boolean {
  return status === "draft" || status === "planning";
}

/**
 * Keep a Places-confirmed pin across parse.
 * Planned outings promote to `draft` on the outing day — without this, parse
 * wiped the plan venue and treated the tab like a cold draft.
 */
export function venueToKeepThroughParse(
  receipt: Pick<Receipt, "status" | "venue">,
): ReceiptVenue | null {
  const v = receipt.venue;
  if (!v) return null;
  if (
    v.source === "places" &&
    typeof v.lat === "number" &&
    typeof v.lng === "number" &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng)
  ) {
    return v;
  }
  if (receipt.status === "planning") return v;
  return null;
}

/** Planning + open + finalized compete for venue-day; drafts do not. */
export function assertNoVenueDayConflict(
  candidates: Receipt[],
  currentId: string,
  venue: ReceiptVenue | null | undefined,
  restaurant: string,
  receiptDate: string | null | undefined,
): void {
  const conflict = findVenueDayConflict(candidates, currentId, venue, restaurant, receiptDate);
  if (conflict) {
    throw Object.assign(new Error("venue_day_taken"), {
      code: "venue_day_taken",
      existingId: conflict.id,
      message: `You already have an outing at ${conflict.restaurant || "this place"} for that day.`,
    });
  }
}
