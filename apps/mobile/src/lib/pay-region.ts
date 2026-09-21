import { getLocales } from "expo-localization";
import type { PayMethod } from "./types";

/**
 * Static region → preferred payment order (suggestions only).
 * Host still picks freely; we just order chips / defaults.
 * Not driven by language — by device regionCode.
 */

const ALL: PayMethod[] = [
  "venmo",
  "paypal",
  "zelle",
  "cashapp",
  "moncash",
  "natcash",
  "other",
];

const US_ORDER: PayMethod[] = [
  "venmo",
  "cashapp",
  "zelle",
  "paypal",
  "moncash",
  "natcash",
  "other",
];

const CA_ORDER: PayMethod[] = [
  "paypal",
  "venmo",
  "cashapp",
  "zelle",
  "moncash",
  "natcash",
  "other",
];

const LATAM_ORDER: PayMethod[] = [
  "paypal",
  "other",
  "cashapp",
  "venmo",
  "zelle",
  "moncash",
  "natcash",
];

const EU_ORDER: PayMethod[] = [
  "paypal",
  "other",
  "venmo",
  "cashapp",
  "zelle",
  "moncash",
  "natcash",
];

/** Haiti — MonCash + Natcash first. */
const HT_ORDER: PayMethod[] = [
  "moncash",
  "natcash",
  "paypal",
  "other",
  "venmo",
  "cashapp",
  "zelle",
];

const DEFAULT_ORDER: PayMethod[] = [
  "paypal",
  "other",
  "venmo",
  "cashapp",
  "zelle",
  "moncash",
  "natcash",
];

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

export function deviceRegionCode(): string | null {
  const code = getLocales()[0]?.regionCode?.toUpperCase();
  return code || null;
}

export function payRegionBucket(regionCode: string | null = deviceRegionCode()): PayRegionBucket {
  if (!regionCode) return "default";
  if (regionCode === "US") return "us";
  if (regionCode === "CA") return "ca";
  if (regionCode === "HT") return "ht";
  if (LATAM.has(regionCode)) return "latam";
  if (EU.has(regionCode)) return "eu";
  return "default";
}

export function payMethodsForRegion(regionCode: string | null = deviceRegionCode()): PayMethod[] {
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
  const missing = ALL.filter((m) => !order.includes(m));
  return [...order, ...missing];
}

export function preferredPayMethod(regionCode: string | null = deviceRegionCode()): PayMethod {
  return payMethodsForRegion(regionCode)[0] ?? "paypal";
}

export function nextUnusedPayMethod(
  used: Iterable<PayMethod>,
  regionCode: string | null = deviceRegionCode(),
): PayMethod | undefined {
  const taken = new Set(used);
  return payMethodsForRegion(regionCode).find((m) => !taken.has(m));
}
