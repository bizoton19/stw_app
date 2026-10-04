/**
 * Last saved RSVP on this browser. Not the claim-link guest id.
 * The server still matches by phone, so another device with the same
 * number updates the same row.
 */

const PREFIX = "stw-rsvp:";

export type RsvpDraft = {
  response: "going" | "maybe" | "cant";
  name: string;
  countryId: string;
  nationalNumber: string;
  contact: string;
  note: string;
  /** Canonical E.164 from the last successful Save. */
  phone: string;
};

export function readRsvpDraft(receiptId: string): RsvpDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${PREFIX}${receiptId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RsvpDraft>;
    if (
      (parsed.response !== "going" && parsed.response !== "maybe" && parsed.response !== "cant") ||
      typeof parsed.name !== "string" ||
      typeof parsed.phone !== "string"
    ) {
      return null;
    }
    return {
      response: parsed.response,
      name: parsed.name,
      countryId: typeof parsed.countryId === "string" ? parsed.countryId : "US",
      nationalNumber: typeof parsed.nationalNumber === "string" ? parsed.nationalNumber : "",
      contact: typeof parsed.contact === "string" ? parsed.contact : "",
      note: typeof parsed.note === "string" ? parsed.note : "",
      phone: parsed.phone,
    };
  } catch {
    return null;
  }
}

export function writeRsvpDraft(receiptId: string, draft: RsvpDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${PREFIX}${receiptId}`, JSON.stringify(draft));
}
