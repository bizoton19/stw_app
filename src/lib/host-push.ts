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
  if (lines.length <= 3) {
    const bits = lines.map((l) => `${l.units}× ${l.name}`).join(", ");
    return `${who} claimed ${bits}`;
  }
  const totalUnits = lines.reduce((s, l) => s + l.units, 0);
  return `${who} claimed ${totalUnits} items`;
}

function boardStatus(payload: HostPushPayload): string | null {
  const parts: string[] = [];
  if (typeof payload.unclaimedCents === "number" && payload.unclaimedCents > 0) {
    parts.push(`${centsToLabel(payload.unclaimedCents)} still unclaimed`);
  } else if (typeof payload.unclaimedCents === "number" && payload.unclaimedCents === 0) {
    parts.push("all items claimed");
  }
  if (typeof payload.unitsLeft === "number" && payload.unitsLeft > 0) {
    parts.push(
      payload.unitsLeft === 1 ? "1 left to claim" : `${payload.unitsLeft} left to claim`,
    );
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
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
