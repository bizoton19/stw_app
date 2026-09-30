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
  const receiptDate = receiptDayKey({
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
  if (input.hostInfo?.payments?.length) {
    hostInfo = {
      payments: input.hostInfo.payments,
      note: input.hostInfo.note ?? input.note ?? null,
    };
  } else if (input.note?.trim()) {
    hostInfo = { payments: [], note: input.note.trim() };
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

export function newInvitee(input: {
  personName: string;
  personContact?: string | null;
  response?: InviteeResponse;
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
    response: input.response ?? "invited",
    inviteSentAt: null,
    updatedAt: now,
  };
}

/**
 * Public board: no tokens; hide Invited rows (except the viewer’s own personalized invite).
 * Going / Maybe / Can’t names stay visible without contact.
 */
export function publicInvitees(
  invitees: Invitee[] | undefined,
  inviteToken?: string | null,
): Invitee[] {
  if (!invitees?.length) return [];
  const token = inviteToken?.trim() || "";
  return invitees
    .filter(
      (row) =>
        row.response !== "invited" || (token.length > 0 && row.inviteToken === token),
    )
    .map((row) => ({
      id: row.id,
      personName: row.personName,
      personContact:
        token && row.inviteToken === token ? row.personContact ?? null : null,
      inviteToken: "",
      response: row.response,
      inviteSentAt: null,
      updatedAt: row.updatedAt,
    }));
}

/** Host board: full roster including tokens for personalized share links. */
export function hostInvitees(invitees: Invitee[] | undefined): Invitee[] {
  return invitees ? [...invitees] : [];
}

export function applyRsvp(
  invitees: Invitee[] | undefined,
  input: {
    response: Exclude<InviteeResponse, "invited">;
    personName?: string;
    personContact?: string | null;
    inviteToken?: string | null;
  },
): Invitee[] {
  const response = input.response;
  if (response !== "going" && response !== "maybe" && response !== "cant") {
    throw Object.assign(new Error("invalid_response"), { code: "invalid" });
  }
  const list = invitees ? [...invitees] : [];
  const now = new Date().toISOString();
  const token = input.inviteToken?.trim();

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
      updatedAt: now,
    };
    return list;
  }

  const name = input.personName?.trim();
  if (!name) {
    throw Object.assign(new Error("name_required"), { code: "invalid" });
  }
  const existing = list.findIndex(
    (row) => row.personName.toLowerCase() === name.toLowerCase() && row.response !== "invited",
  );
  if (existing >= 0) {
    list[existing] = {
      ...list[existing],
      personContact: input.personContact?.trim() || list[existing].personContact || null,
      response,
      updatedAt: now,
    };
    return list;
  }
  list.push(
    newInvitee({
      personName: name,
      personContact: input.personContact,
      response,
    }),
  );
  return list;
}

/** Statuses that may receive a receipt photo parse. */
export function canParseStatus(status: Receipt["status"]): boolean {
  return status === "draft" || status === "planning";
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
