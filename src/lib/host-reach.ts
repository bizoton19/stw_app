import type { HostReach, HostReachChannel } from "./types";

export const HOST_REACH_CHANNELS: HostReachChannel[] = [
  "imessage",
  "sms",
  "whatsapp",
  "email",
  "signal",
  "other",
];

export const HOST_REACH_LABEL: Record<HostReachChannel, string> = {
  imessage: "iMessage",
  sms: "Text",
  whatsapp: "WhatsApp",
  email: "Email",
  signal: "Signal",
  other: "Other",
};

function isChannel(value: unknown): value is HostReachChannel {
  return typeof value === "string" && (HOST_REACH_CHANNELS as string[]).includes(value);
}

export function normalizeHostReach(raw: unknown): HostReach | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const body = raw as { channel?: unknown; value?: unknown };
  if (!isChannel(body.channel)) return undefined;
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) return undefined;
  return { channel: body.channel, value };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Build a URL guests can open to reach the host. */
export function hostReachUrl(reach: HostReach): string | null {
  const value = reach.value.trim();
  if (!value) return null;
  switch (reach.channel) {
    case "email":
      return `mailto:${encodeURIComponent(value)}`;
    case "whatsapp": {
      const phone = digitsOnly(value);
      if (!phone) return null;
      return `https://wa.me/${phone}`;
    }
    case "signal": {
      const phone = digitsOnly(value);
      if (phone) return `https://signal.me/#p/+${phone.replace(/^\+/, "")}`;
      return value.startsWith("http") ? value : null;
    }
    case "imessage":
    case "sms": {
      const tel = value.replace(/\s/g, "");
      return `sms:${tel}`;
    }
    case "other":
      if (EMAIL_RE.test(value)) return `mailto:${encodeURIComponent(value)}`;
      if (/^https?:\/\//i.test(value)) return value;
      if (digitsOnly(value).length >= 7) return `sms:${value.replace(/\s/g, "")}`;
      return null;
  }
}

export type DirectionsTarget = {
  lat?: number | null;
  lng?: number | null;
  name?: string | null;
  googleMapsUri?: string | null;
};

/** Apple Maps on iOS, Google Maps elsewhere; falls back to googleMapsUri or geo:. */
export function directionsUrl(
  target: DirectionsTarget,
  platform: "ios" | "android" | "web" = "web",
): string | null {
  const { lat, lng, name, googleMapsUri } = target;
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const label = encodeURIComponent(name?.trim() || "Destination");

  if (platform === "ios" && hasCoords) {
    return `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`;
  }
  if (hasCoords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const maps = googleMapsUri?.trim();
  if (maps && /^https?:\/\//i.test(maps)) return maps;
  return null;
}
