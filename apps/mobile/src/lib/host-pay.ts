import type { HostInfo, HostPayment, PayMethod } from "./types";
import { nextUnusedPayMethod, payMethodsForRegion, preferredPayMethod } from "./pay-region";

/** Region-ordered catalog (suggestions). Host may still pick any method. */
export const PAY_METHODS: PayMethod[] = payMethodsForRegion();

const METHODS: PayMethod[] = [
  "venmo",
  "paypal",
  "zelle",
  "cashapp",
  "moncash",
  "natcash",
  "other",
];

function isMethod(value: unknown): value is PayMethod {
  return typeof value === "string" && (METHODS as string[]).includes(value);
}

/** Accepts `{ payments: [...] }` or legacy `{ method, handle }`. */
export function normalizeHostInfo(input: unknown): HostInfo | null {
  if (!input || typeof input !== "object") return null;
  const body = input as {
    payments?: unknown;
    method?: unknown;
    handle?: unknown;
  };

  if (Array.isArray(body.payments)) {
    const payments: HostPayment[] = [];
    for (const row of body.payments) {
      if (!row || typeof row !== "object") continue;
      const payment = row as { method?: unknown; handle?: unknown };
      if (!isMethod(payment.method)) continue;
      const handle = typeof payment.handle === "string" ? payment.handle.trim() : "";
      if (!handle) continue;
      if (payments.some((p) => p.method === payment.method)) continue;
      payments.push({ method: payment.method, handle });
    }
    return payments.length > 0 ? { payments } : null;
  }

  if (isMethod(body.method) && typeof body.handle === "string" && body.handle.trim()) {
    return { payments: [{ method: body.method, handle: body.handle.trim() }] };
  }
  return null;
}

export function hostPayments(info?: HostInfo | null): HostPayment[] {
  return info?.payments ?? [];
}

export function primaryHostPayment(info?: HostInfo | null): HostPayment | null {
  return hostPayments(info)[0] ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;
/** Haiti mobile: +509 + 8 digits, or local 8 digits. */
const HT_PHONE_RE = /^(?:\+?509[\s.-]?)?\d{8}$/;
const VENMO_RE = /^@?[A-Za-z0-9_-]{1,30}$/;
const CASH_RE = /^\$?[A-Za-z0-9_]{1,20}$/;
const PAYPAL_ME_RE = /^(?:https?:\/\/)?(?:www\.)?paypal\.me\/[A-Za-z0-9_-]+\/?$/i;
const PAYPAL_USER_RE = /^@?[A-Za-z0-9_-]{3,30}$/;

/** Soft format check — catches typos without requiring live API lookup. */
export function validatePaymentHandle(
  method: PayMethod,
  handle: string,
): { ok: true } | { ok: false; message: string } {
  const value = handle.trim();
  if (!value) return { ok: false, message: "Add how people should pay you." };

  switch (method) {
    case "venmo":
      if (!VENMO_RE.test(value)) {
        return { ok: false, message: "Venmo looks like @username (letters, numbers, _ or -)." };
      }
      return { ok: true };
    case "cashapp":
      if (!CASH_RE.test(value)) {
        return { ok: false, message: "Cash App looks like $cashtag (letters, numbers, or _)." };
      }
      return { ok: true };
    case "zelle":
      if (EMAIL_RE.test(value) || PHONE_RE.test(value.replace(/\s/g, ""))) return { ok: true };
      return { ok: false, message: "Zelle needs an email or phone number." };
    case "moncash":
    case "natcash": {
      const digits = value.replace(/[\s().-]/g, "");
      if (HT_PHONE_RE.test(digits) || PHONE_RE.test(value.replace(/\s/g, ""))) return { ok: true };
      return {
        ok: false,
        message: `${method === "moncash" ? "MonCash" : "Natcash"} needs a Haiti phone (+509…).`,
      };
    }
    case "paypal":
      if (EMAIL_RE.test(value) || PAYPAL_ME_RE.test(value) || PAYPAL_USER_RE.test(value)) {
        return { ok: true };
      }
      return {
        ok: false,
        message: "PayPal needs an email, @username, or paypal.me/name link.",
      };
    case "other":
      if (value.length < 2) return { ok: false, message: "Add a bit more detail." };
      return { ok: true };
  }
}

export function validateHostPayments(
  payments: HostPayment[],
): { ok: true; payments: HostPayment[] } | { ok: false; message: string; index: number } {
  const cleaned: HostPayment[] = [];
  for (let i = 0; i < payments.length; i++) {
    const row = payments[i];
    const handle = row.handle.trim();
    if (!handle) {
      return { ok: false, message: "Fill in every payment method, or remove the empty one.", index: i };
    }
    const check = validatePaymentHandle(row.method, handle);
    if (!check.ok) return { ok: false, message: check.message, index: i };
    cleaned.push({ method: row.method, handle });
  }
  if (cleaned.length === 0) {
    return { ok: false, message: "Add at least one way to get paid.", index: 0 };
  }
  return { ok: true, payments: cleaned };
}

export { preferredPayMethod, nextUnusedPayMethod, payMethodsForRegion };
