/**
 * Email + phone validation for guest contact and pay handles.
 * Phone values normalize to E.164 (+country…digits).
 */

export type DialCode = {
  iso: string;
  name: string;
  dial: string;
  /** Exact national digit count, or [min, max]. */
  nationalLen: number | [number, number];
};

/** Common dial codes — US default for most hosts/guests. */
export const DIAL_CODES: DialCode[] = [
  { iso: "US", name: "United States", dial: "+1", nationalLen: 10 },
  { iso: "CA", name: "Canada", dial: "+1", nationalLen: 10 },
  { iso: "HT", name: "Haiti", dial: "+509", nationalLen: 8 },
  { iso: "MX", name: "Mexico", dial: "+52", nationalLen: 10 },
  { iso: "GB", name: "United Kingdom", dial: "+44", nationalLen: [10, 11] },
  { iso: "FR", name: "France", dial: "+33", nationalLen: 9 },
  { iso: "DO", name: "Dominican Republic", dial: "+1", nationalLen: 10 },
  { iso: "PR", name: "Puerto Rico", dial: "+1", nationalLen: 10 },
  { iso: "JM", name: "Jamaica", dial: "+1", nationalLen: 10 },
  { iso: "BR", name: "Brazil", dial: "+55", nationalLen: [10, 11] },
  { iso: "CO", name: "Colombia", dial: "+57", nationalLen: 10 },
  { iso: "AR", name: "Argentina", dial: "+54", nationalLen: [10, 11] },
  { iso: "ES", name: "Spain", dial: "+34", nationalLen: 9 },
  { iso: "DE", name: "Germany", dial: "+49", nationalLen: [10, 11] },
  { iso: "IT", name: "Italy", dial: "+39", nationalLen: [9, 10] },
  { iso: "AU", name: "Australia", dial: "+61", nationalLen: 9 },
  { iso: "IN", name: "India", dial: "+91", nationalLen: 10 },
  { iso: "NG", name: "Nigeria", dial: "+234", nationalLen: [10, 11] },
  { iso: "KE", name: "Kenya", dial: "+254", nationalLen: 9 },
  { iso: "ZA", name: "South Africa", dial: "+27", nationalLen: 9 },
];

export const DEFAULT_DIAL = DIAL_CODES[0]!;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function findDialByIso(iso: string): DialCode {
  return DIAL_CODES.find((c) => c.iso === iso) ?? DEFAULT_DIAL;
}

export function findDialByCode(dial: string): DialCode | undefined {
  const d = dial.startsWith("+") ? dial : `+${dial}`;
  return DIAL_CODES.find((c) => c.dial === d);
}

export function validateEmail(
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim().toLowerCase();
  if (!value) return { ok: false, message: "Enter an email address." };
  if (value.length > 254) return { ok: false, message: "Email is too long." };
  if (!EMAIL_RE.test(value)) return { ok: false, message: "That email doesn’t look right." };
  return { ok: true, value };
}

function nationalLenOk(len: number, rule: number | [number, number]): boolean {
  if (typeof rule === "number") return len === rule;
  return len >= rule[0] && len <= rule[1];
}

export function validatePhoneNational(
  nationalRaw: string,
  dialOrIso: DialCode | string,
): { ok: true; e164: string; dial: DialCode } | { ok: false; message: string } {
  const dial =
    typeof dialOrIso === "string"
      ? findDialByIso(dialOrIso) || findDialByCode(dialOrIso) || DEFAULT_DIAL
      : dialOrIso;
  let national = digitsOnly(nationalRaw);
  // Strip leading 0 often typed for local numbers.
  if (national.startsWith("0") && national.length > 1) {
    national = national.slice(1);
  }
  if (!national) return { ok: false, message: "Enter a phone number." };
  if (!nationalLenOk(national.length, dial.nationalLen)) {
    const expect =
      typeof dial.nationalLen === "number"
        ? `${dial.nationalLen} digits`
        : `${dial.nationalLen[0]}–${dial.nationalLen[1]} digits`;
    return {
      ok: false,
      message: `${dial.name} numbers need ${expect} (after ${dial.dial}).`,
    };
  }
  return { ok: true, e164: `${dial.dial}${national}`, dial };
}

/** Accept pasted E.164 or national+dial. */
export function validatePhoneFlexible(
  raw: string,
  preferredDial: DialCode = DEFAULT_DIAL,
): { ok: true; e164: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "Enter a phone number." };

  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed);
    // Match longest dial prefix first.
    const sorted = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
    for (const code of sorted) {
      const prefix = digitsOnly(code.dial);
      if (digits.startsWith(prefix)) {
        const national = digits.slice(prefix.length);
        const check = validatePhoneNational(national, code);
        if (check.ok) return { ok: true, e164: check.e164 };
      }
    }
    if (digits.length >= 8 && digits.length <= 15) {
      return { ok: true, e164: `+${digits}` };
    }
    return { ok: false, message: "That phone number doesn’t look right." };
  }

  const check = validatePhoneNational(trimmed, preferredDial);
  if (!check.ok) return check;
  return { ok: true, e164: check.e164 };
}

export type GuestContactKind = "email" | "phone" | "";

/**
 * Optional guest contact: empty OK; otherwise must be valid email or phone.
 */
export function validateOptionalGuestContact(opts: {
  kind: GuestContactKind;
  email?: string;
  phoneNational?: string;
  dialIso?: string;
}): { ok: true; contact: string } | { ok: false; message: string } {
  if (!opts.kind) return { ok: true, contact: "" };
  if (opts.kind === "email") {
    const email = validateEmail(opts.email ?? "");
    if (!email.ok) return email;
    return { ok: true, contact: email.value };
  }
  const phone = validatePhoneNational(opts.phoneNational ?? "", opts.dialIso ?? "US");
  if (!phone.ok) return phone;
  return { ok: true, contact: phone.e164 };
}

export function isEmailContact(value: string): boolean {
  return value.includes("@");
}

export function isE164Contact(value: string): boolean {
  return /^\+\d{8,15}$/.test(value.trim());
}
