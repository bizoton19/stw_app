import type { HostInfo, HostPayment, PayMethod } from "./types";

const METHODS: PayMethod[] = ["venmo", "zelle", "cashapp", "other"];

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
