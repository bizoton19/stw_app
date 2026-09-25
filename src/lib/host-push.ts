/**
 * Host claim push — Expo Push API.
 * Tokens registered per receipt with host token; fire-and-forget after claim/unclaim.
 */

export type HostPushLine = { name: string; units: number };

export type HostPushPayload = {
  receiptId: string;
  kind: "claim" | "unclaim";
  personName: string;
  lines: HostPushLine[];
  restaurant?: string | null;
};

export function formatHostPushBody(payload: HostPushPayload): string {
  const who = payload.personName.trim() || "Someone";
  const lines = payload.lines.filter((l) => l.name.trim() && l.units > 0);
  if (payload.kind === "unclaim") {
    const line = lines[0];
    if (!line) return `${who} dropped a claim`;
    return `${who} dropped ${line.name}`;
  }
  if (lines.length === 0) return `${who} claimed on tonight’s tab`;
  if (lines.length === 1) {
    const line = lines[0]!;
    return `${who} claimed ${line.units}× ${line.name}`;
  }
  const totalUnits = lines.reduce((s, l) => s + l.units, 0);
  const place = payload.restaurant?.trim();
  if (place) return `${who} claimed ${totalUnits} items at ${place}`;
  return `${who} claimed ${totalUnits} items on tonight’s tab`;
}

export async function sendExpoPushMessages(
  tokens: string[],
  payload: HostPushPayload,
): Promise<void> {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const body = formatHostPushBody(payload);
  const messages = unique.map((to) => ({
    to,
    sound: "default" as const,
    title: "Split the Wine",
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
