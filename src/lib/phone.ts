/** Dial codes + soft national-length checks for host reach phones. */

export type DialCountry = {
  region: string;
  dial: string;
  label: string;
  /** Accepted national digit lengths (after dial code stripped). */
  lengths: number[];
};

/** Common regions for this product — US/CA/HT first, then frequent guests. */
export const DIAL_COUNTRIES: DialCountry[] = [
  { region: "US", dial: "1", label: "United States +1", lengths: [10] },
  { region: "CA", dial: "1", label: "Canada +1", lengths: [10] },
  { region: "HT", dial: "509", label: "Haiti +509", lengths: [8] },
  { region: "DO", dial: "1", label: "Dominican Republic +1", lengths: [10] },
  { region: "MX", dial: "52", label: "Mexico +52", lengths: [10] },
  { region: "GB", dial: "44", label: "United Kingdom +44", lengths: [10, 11] },
  { region: "FR", dial: "33", label: "France +33", lengths: [9] },
  { region: "DE", dial: "49", label: "Germany +49", lengths: [10, 11] },
  { region: "BR", dial: "55", label: "Brazil +55", lengths: [10, 11] },
  { region: "AU", dial: "61", label: "Australia +61", lengths: [9] },
  { region: "ES", dial: "34", label: "Spain +34", lengths: [9] },
  { region: "IT", dial: "39", label: "Italy +39", lengths: [9, 10] },
  { region: "NL", dial: "31", label: "Netherlands +31", lengths: [9] },
  { region: "JM", dial: "1", label: "Jamaica +1", lengths: [10] },
  { region: "PR", dial: "1", label: "Puerto Rico +1", lengths: [10] },
];

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function dialCountryForRegion(region: string | null | undefined): DialCountry {
  const code = region?.toUpperCase() || "US";
  return DIAL_COUNTRIES.find((c) => c.region === code) ?? DIAL_COUNTRIES[0];
}

export function dialCountryByDial(dial: string): DialCountry | undefined {
  const d = digitsOnly(dial);
  return DIAL_COUNTRIES.find((c) => c.dial === d);
}

/** Build +E164 from country dial + national number (no leading 0). */
export function toE164(dial: string, national: string): string {
  const d = digitsOnly(dial);
  let n = digitsOnly(national);
  // Drop trunk 0 (e.g. UK 07… → 7…)
  if (n.startsWith("0")) n = n.slice(1);
  return `+${d}${n}`;
}

export function validatePhoneParts(
  dial: string,
  national: string,
): { ok: true; e164: string } | { ok: false; message: string } {
  const d = digitsOnly(dial);
  let n = digitsOnly(national);
  if (!d) return { ok: false, message: "Pick a country code." };
  if (!n) return { ok: false, message: "Add your phone number." };
  if (n.startsWith("0")) n = n.slice(1);
  const country =
    DIAL_COUNTRIES.find((c) => c.dial === d && c.lengths.includes(n.length)) ??
    DIAL_COUNTRIES.find((c) => c.dial === d);
  if (country && !country.lengths.includes(n.length)) {
    const expect = country.lengths.join(" or ");
    return {
      ok: false,
      message: `${country.region} numbers need ${expect} digits (you entered ${n.length}).`,
    };
  }
  if (!country && (n.length < 6 || n.length > 12)) {
    return { ok: false, message: "That phone number looks too short or too long." };
  }
  return { ok: true, e164: `+${d}${n}` };
}

/** Soft check for a stored E.164 / international string. */
export function validateE164(value: string): { ok: true; e164: string } | { ok: false; message: string } {
  const raw = value.trim();
  if (!raw) return { ok: false, message: "Add your phone number." };
  const digits = digitsOnly(raw);
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, message: "That phone number doesn’t look right." };
  }
  const e164 = raw.startsWith("+") ? `+${digits}` : `+${digits}`;
  return { ok: true, e164 };
}

/** Split +15551234567 → dial country + national digits for editing. */
export function splitE164(
  value: string,
  preferredRegion?: string | null,
): { country: DialCountry; national: string } {
  const digits = digitsOnly(value);
  const preferred = dialCountryForRegion(preferredRegion);
  // Prefer longer dial matches (509 before 1).
  const sorted = [...DIAL_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) {
      const national = digits.slice(c.dial.length);
      if (c.lengths.includes(national.length) || national.length >= 6) {
        // Prefer preferred region's dial when both US/CA share +1
        if (c.dial === preferred.dial && preferred.region !== c.region) {
          const alt = sorted.find(
            (x) => x.region === preferred.region && digits.startsWith(x.dial),
          );
          if (alt) {
            return { country: alt, national: digits.slice(alt.dial.length) };
          }
        }
        return { country: c, national };
      }
    }
  }
  return { country: preferred, national: digits };
}
