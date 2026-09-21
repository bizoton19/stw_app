import type { PayMethod } from "./types";

/**
 * Browser region → preferred payment order (suggestions only).
 * MonCash / Natcash are Haiti-only (region HT).
 */

const CORE: PayMethod[] = ["venmo", "paypal", "zelle", "cashapp", "other"];
const HT_ONLY: PayMethod[] = ["moncash", "natcash"];

const US_ORDER: PayMethod[] = ["venmo", "cashapp", "zelle", "paypal", "other"];
const CA_ORDER: PayMethod[] = ["paypal", "venmo", "cashapp", "zelle", "other"];
const LATAM_ORDER: PayMethod[] = ["paypal", "other", "cashapp", "venmo", "zelle"];
const EU_ORDER: PayMethod[] = ["paypal", "other", "venmo", "cashapp", "zelle"];
const HT_ORDER: PayMethod[] = [
  "moncash",
  "natcash",
  "paypal",
  "other",
  "venmo",
  "cashapp",
  "zelle",
];
const DEFAULT_ORDER: PayMethod[] = ["paypal", "other", "venmo", "cashapp", "zelle"];

const LATAM = new Set([
  "MX",
  "AR",
  "BR",
  "CL",
  "CO",
  "PE",
  "UY",
  "PY",
  "BO",
  "EC",
  "CR",
  "PA",
  "GT",
  "HN",
  "SV",
  "NI",
  "DO",
  "CU",
  "VE",
]);

const EU = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "IS",
  "NO",
  "CH",
  "LI",
]);

export type PayRegionBucket = "us" | "ca" | "ht" | "latam" | "eu" | "default";

export function browserRegionCode(): string | null {
  if (typeof navigator === "undefined") return null;
  try {
    const region = new Intl.Locale(navigator.language).region;
    return region ? region.toUpperCase() : null;
  } catch {
    const parts = navigator.language.split("-");
    return parts.length > 1 ? parts[parts.length - 1]!.toUpperCase() : null;
  }
}

export function payRegionBucket(regionCode: string | null = browserRegionCode()): PayRegionBucket {
  if (!regionCode) return "default";
  if (regionCode === "US") return "us";
  if (regionCode === "CA") return "ca";
  if (regionCode === "HT") return "ht";
  if (LATAM.has(regionCode)) return "latam";
  if (EU.has(regionCode)) return "eu";
  return "default";
}

function catalogFor(bucket: PayRegionBucket): PayMethod[] {
  return bucket === "ht" ? [...CORE, ...HT_ONLY] : [...CORE];
}

export function payMethodsForRegion(regionCode: string | null = browserRegionCode()): PayMethod[] {
  const bucket = payRegionBucket(regionCode);
  const order =
    bucket === "us"
      ? US_ORDER
      : bucket === "ca"
        ? CA_ORDER
        : bucket === "ht"
          ? HT_ORDER
          : bucket === "latam"
            ? LATAM_ORDER
            : bucket === "eu"
              ? EU_ORDER
              : DEFAULT_ORDER;
  const catalog = catalogFor(bucket);
  const missing = catalog.filter((m) => !order.includes(m));
  return [...order.filter((m) => catalog.includes(m)), ...missing];
}
