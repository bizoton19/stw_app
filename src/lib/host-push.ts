/**
 * Host claim push — Expo Push API.
 * Tokens registered per receipt with host token; fire-and-forget after claim/unclaim.
 */

import { centsToLabel } from "./money";

export type HostPushLine = { name: string; units: number };

export type HostPushPayload = {
  receiptId: string;
  kind: "claim" | "unclaim";
  personName: string;
  lines: HostPushLine[];
  restaurant?: string | null;
  /** ISO date `YYYY-MM-DD` when known. */
  receiptDate?: string | null;
  /** Item $ still unclaimed after this event (excludes fees). */
  unclaimedCents?: number;
  /** Whole units still left to claim across all lines. */
  unitsLeft?: number;
};

export function formatReceiptDayLabel(isoDay?: string | null): string | null {
  if (!isoDay || !/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return null;
  const [y, m, d] = isoDay.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  const todayKey = new Date().toISOString().slice(0, 10);
  if (isoDay === todayKey) return "Today";
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatHostPushTitle(payload: HostPushPayload): string {
  const place = payload.restaurant?.trim() || "Tonight’s tab";
  const day = formatReceiptDayLabel(payload.receiptDate);
  return day ? `${place} · ${day}` : place;
}

function claimAction(payload: HostPushPayload): string {
  const who = payload.personName.trim() || "Someone";
  const lines = payload.lines.filter((l) => l.name.trim() && l.units > 0);
  if (payload.kind === "unclaim") {
    const line = lines[0];
    if (!line) return `${who} dropped a claim`;
    return `${who} dropped ${line.name}`;
  }
  if (lines.length === 0) return `${who} claimed on the tab`;
  if (lines.length === 1) {
    const line = lines[0]!;
    return `${who} claimed ${line.units}× ${line.name}`;
  }
  const totalUnits = lines.reduce((s, l) => s + l.units, 0);
  return `${who} claimed ${totalUnits} items`;
}

function boardStatus(payload: HostPushPayload): string | null {
  const left = payload.unitsLeft;
  const cents = payload.unclaimedCents;
  if (typeof left === "number" && left <= 0 && typeof cents === "number" && cents <= 0) {
    return "all claimed";
  }
  if (typeof left === "number" && left > 0 && typeof cents === "number") {
    const noun = left === 1 ? "item" : "items";
    return `${left} ${noun} (${centsToLabel(cents)}) still unclaimed`;
  }
  if (typeof left === "number" && left > 0) {
    return left === 1 ? "1 item still unclaimed" : `${left} items still unclaimed`;
  }
  if (typeof cents === "number" && cents > 0) {
    return `${centsToLabel(cents)} still unclaimed`;
  }
  if (typeof cents === "number" && cents === 0) {
    return "all claimed";
  }
  return null;
}

export function formatHostPushBody(payload: HostPushPayload): string {
  const action = claimAction(payload);
  const status = boardStatus(payload);
  return status ? `${action} · ${status}` : action;
}

export async function sendExpoPushMessages(
  tokens: string[],
  payload: HostPushPayload,
): Promise<void> {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const title = formatHostPushTitle(payload);
  const body = formatHostPushBody(payload);
  const messages = unique.map((to) => ({
    to,
    sound: "default" as const,
    title,
    body,
    data: {
      receiptId: payload.receiptId,
      kind: payload.kind,
      screen: "settle",
    },
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        JSON.stringify({
          event: "host.push.failed",
          status: res.status,
          body: text.slice(0, 200),
          receiptId: payload.receiptId,
        }),
      );
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "host.push.error",
        receiptId: payload.receiptId,
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
  }
}
