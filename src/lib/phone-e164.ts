/**
 * RSVP phone identity.
 *
 * The composed E.164 string is the unique key for an outing.
 * The country dropdown and national number stay on the device until Save.
 * Do not send them separately, and do not send a session token or guestId.
 *
 * Keep in sync with `apps/mobile/src/lib/phone-e164.ts`.
 */

export type CallingCountry = {
  id: string;
  /** Closed control, e.g. "US +1". */
  abbr: string;
  name: string;
  callingCode: string;
};

const COUNTRY_REST: CallingCountry[] = [
  { id: "AR", abbr: "AR", name: "Argentina", callingCode: "+54" },
  { id: "AU", abbr: "AU", name: "Australia", callingCode: "+61" },
  { id: "AT", abbr: "AT", name: "Austria", callingCode: "+43" },
  { id: "BE", abbr: "BE", name: "Belgium", callingCode: "+32" },
  { id: "BR", abbr: "BR", name: "Brazil", callingCode: "+55" },
  { id: "CA", abbr: "CA", name: "Canada", callingCode: "+1" },
  { id: "CL", abbr: "CL", name: "Chile", callingCode: "+56" },
  { id: "CN", abbr: "CN", name: "China", callingCode: "+86" },
  { id: "CO", abbr: "CO", name: "Colombia", callingCode: "+57" },
  { id: "DK", abbr: "DK", name: "Denmark", callingCode: "+45" },
  { id: "EG", abbr: "EG", name: "Egypt", callingCode: "+20" },
  { id: "FR", abbr: "FR", name: "France", callingCode: "+33" },
  { id: "DE", abbr: "DE", name: "Germany", callingCode: "+49" },
  { id: "GH", abbr: "GH", name: "Ghana", callingCode: "+233" },
  { id: "GR", abbr: "GR", name: "Greece", callingCode: "+30" },
  { id: "HT", abbr: "HT", name: "Haiti", callingCode: "+509" },
  { id: "IN", abbr: "IN", name: "India", callingCode: "+91" },
  { id: "ID", abbr: "ID", name: "Indonesia", callingCode: "+62" },
  { id: "IE", abbr: "IE", name: "Ireland", callingCode: "+353" },
  { id: "IL", abbr: "IL", name: "Israel", callingCode: "+972" },
  { id: "IT", abbr: "IT", name: "Italy", callingCode: "+39" },
  { id: "JP", abbr: "JP", name: "Japan", callingCode: "+81" },
  { id: "KE", abbr: "KE", name: "Kenya", callingCode: "+254" },
  { id: "MX", abbr: "MX", name: "Mexico", callingCode: "+52" },
  { id: "NL", abbr: "NL", name: "Netherlands", callingCode: "+31" },
  { id: "NZ", abbr: "NZ", name: "New Zealand", callingCode: "+64" },
  { id: "NG", abbr: "NG", name: "Nigeria", callingCode: "+234" },
  { id: "NO", abbr: "NO", name: "Norway", callingCode: "+47" },
  { id: "PH", abbr: "PH", name: "Philippines", callingCode: "+63" },
  { id: "PL", abbr: "PL", name: "Poland", callingCode: "+48" },
  { id: "PT", abbr: "PT", name: "Portugal", callingCode: "+351" },
  { id: "SA", abbr: "SA", name: "Saudi Arabia", callingCode: "+966" },
  { id: "SG", abbr: "SG", name: "Singapore", callingCode: "+65" },
  { id: "ZA", abbr: "ZA", name: "South Africa", callingCode: "+27" },
  { id: "KR", abbr: "KR", name: "South Korea", callingCode: "+82" },
  { id: "ES", abbr: "ES", name: "Spain", callingCode: "+34" },
  { id: "SE", abbr: "SE", name: "Sweden", callingCode: "+46" },
  { id: "CH", abbr: "CH", name: "Switzerland", callingCode: "+41" },
  { id: "TR", abbr: "TR", name: "Turkey", callingCode: "+90" },
  { id: "AE", abbr: "AE", name: "United Arab Emirates", callingCode: "+971" },
  { id: "UK", abbr: "UK", name: "United Kingdom", callingCode: "+44" },
  { id: "VN", abbr: "VN", name: "Vietnam", callingCode: "+84" },
];

/** United States first. Every other country is alphabetical. Not locale-detected. */
export const CALLING_COUNTRIES: CallingCountry[] = [
  { id: "US", abbr: "US", name: "United States", callingCode: "+1" },
  ...COUNTRY_REST,
];

export const DEFAULT_COUNTRY_ID = "US";

const PLUS1 = /^\+1\d{10}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export function countryById(id: string | null | undefined): CallingCountry {
  return CALLING_COUNTRIES.find((country) => country.id === id) ?? CALLING_COUNTRIES[0]!;
}

export function nationalPlaceholder(countryId: string): string {
  const country = countryById(countryId);
  if (country.id === "US" || country.id === "CA") return "202-555-0100";
  return "Phone number";
}

/** True when `value` is the canonical RSVP key. */
export function isRsvpPhone(value: string): boolean {
  if (value.startsWith("+1")) return PLUS1.test(value);
  return E164.test(value);
}

/**
 * A stored `+1…` number reopens as United States, never Canada.
 * Other numbers use the longest matching calling code.
 */
export function fieldsFromStoredPhone(phone: string): { countryId: string; nationalNumber: string } {
  const value = phone.trim();
  if (value.startsWith("+1")) {
    return { countryId: "US", nationalNumber: value.slice(2).replace(/\D/g, "") };
  }
  const match = CALLING_COUNTRIES.filter(
    (country) => country.callingCode !== "+1" && value.startsWith(country.callingCode),
  ).sort((a, b) => b.callingCode.length - a.callingCode.length)[0];
  if (!match) return { countryId: DEFAULT_COUNTRY_ID, nationalNumber: "" };
  return {
    countryId: match.id,
    nationalNumber: value.slice(match.callingCode.length).replace(/\D/g, ""),
  };
}

/**
 * Country + national digits → `+12025550100`.
 * Spaces, dashes, and parentheses in the national number are ignored.
 * Letters or any other symbol are invalid.
 */
export function composeE164(countryId: string, nationalRaw: string): string | null {
  const country = countryById(countryId);
  if (/[a-z]/i.test(nationalRaw)) return null;
  const stripped = nationalRaw.replace(/[ \-()]/g, "");
  if (!/^\d+$/.test(stripped)) return null;
  const phone = `${country.callingCode}${stripped}`;
  if (country.callingCode === "+1") return PLUS1.test(phone) ? phone : null;
  return E164.test(phone) ? phone : null;
}

export function rsvpPhoneSaveError(countryId: string, nationalRaw: string): string | null {
  if (!nationalRaw.trim()) return "Add a phone number so we know it’s you.";
  if (!composeE164(countryId, nationalRaw)) return "That phone number doesn’t look complete.";
  return null;
}

/** Wire value. Empty or invalid throws `{ code: "invalid" }`. */
export function readRsvpPhone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error("phone_required"), {
      code: "invalid",
      message: "Add a phone number so we know it’s you.",
    });
  }
  const phone = value.trim();
  if (!isRsvpPhone(phone)) {
    throw Object.assign(new Error("invalid_phone"), {
      code: "invalid",
      message: "That phone number doesn’t look complete.",
    });
  }
  return phone;
}
