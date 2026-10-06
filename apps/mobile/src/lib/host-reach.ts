import { Linking, Platform } from "react-native";
import type { HostReach, HostReachChannel } from "./types";
import { digitsOnly, validateE164 } from "./phone";

const ALL_REACH_CHANNELS: HostReachChannel[] = [
  "imessage",
  "sms",
  "whatsapp",
  "email",
  "signal",
  "other",
];

export const HOST_REACH_CHANNELS: HostReachChannel[] =
  Platform.OS === "ios"
    ? ["imessage", "sms", "whatsapp", "email", "signal", "other"]
    : ["sms", "whatsapp", "email", "signal", "other"];

export const HOST_REACH_LABEL: Record<HostReachChannel, string> = {
  imessage: "iMessage",
  sms: "Text",
  whatsapp: "WhatsApp",
  email: "Email",
  signal: "Signal",
  other: "Other",
};

export const PHONE_REACH_CHANNELS: HostReachChannel[] = [
  "imessage",
  "sms",
  "whatsapp",
  "signal",
];

export function isPhoneReachChannel(channel: HostReachChannel): boolean {
  return (PHONE_REACH_CHANNELS as string[]).includes(channel);
}

function isChannel(value: unknown): value is HostReachChannel {
  return typeof value === "string" && (ALL_REACH_CHANNELS as string[]).includes(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateHostReach(
  channel: HostReachChannel,
  value: string,
): { ok: true; reach: HostReach } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: "Add how people can reach you." };

  if (isPhoneReachChannel(channel)) {
    const phone = validateE164(trimmed);
    if (!phone.ok) return phone;
    return { ok: true, reach: { channel, value: phone.e164 } };
  }

  if (channel === "email") {
    if (!EMAIL_RE.test(trimmed)) {
      return { ok: false, message: "That email doesn’t look right." };
    }
    return { ok: true, reach: { channel, value: trimmed } };
  }

  if (trimmed.length < 2) return { ok: false, message: "Add a bit more detail." };
  return { ok: true, reach: { channel, value: trimmed } };
}

export function normalizeHostReach(raw: unknown): HostReach | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const body = raw as { channel?: unknown; value?: unknown };
  if (!isChannel(body.channel)) return undefined;
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) return undefined;
  const checked = validateHostReach(body.channel, value);
  return checked.ok ? checked.reach : undefined;
}

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
      if (phone) return `https://signal.me/#p/+${phone}`;
      return value.startsWith("http") ? value : null;
    }
    case "imessage":
    case "sms": {
      const e164 = value.startsWith("+") ? value.replace(/\s/g, "") : `+${digitsOnly(value)}`;
      return `sms:${e164}`;
    }
    case "other":
      if (EMAIL_RE.test(value)) return `mailto:${encodeURIComponent(value)}`;
      if (/^https?:\/\//i.test(value)) return value;
      if (digitsOnly(value).length >= 7) {
        const e164 = value.startsWith("+") ? value.replace(/\s/g, "") : `+${digitsOnly(value)}`;
        return `sms:${e164}`;
      }
      return null;
  }
}

export function openHostReach(reach: HostReach): void {
  const url = hostReachUrl(reach);
  if (url) void Linking.openURL(url);
}

export type DirectionsTarget = {
  lat?: number | null;
  lng?: number | null;
  name?: string | null;
  googleMapsUri?: string | null;
};

export function directionsUrl(target: DirectionsTarget): string | null {
  const { lat, lng, name, googleMapsUri } = target;
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const label = encodeURIComponent(name?.trim() || "Destination");
  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

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

export function openDirections(target: DirectionsTarget): void {
  const url = directionsUrl(target);
  if (url) void Linking.openURL(url);
}
