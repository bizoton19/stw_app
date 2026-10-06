"use client";

import { useMemo, useState } from "react";
import { ContinueButton, QuietButton } from "@/components/interview-chrome";
import { HostMessage } from "@/components/host-message";
import { hostNoteText } from "@/lib/host-pay";
import {
  HOST_REACH_LABEL,
  directionsUrl,
  hostReachUrl,
} from "@/lib/host-reach";
import { staticMapForClient } from "@/lib/nearby-place-card";
import type { PublicReceipt } from "@/lib/types";

export type RsvpResponse = "going" | "maybe" | "cant";

function formatWhen(nightAt: string | null | undefined): { date: string; time: string } | null {
  if (!nightAt) return null;
  const d = new Date(nightAt);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function headline(response: RsvpResponse): string {
  switch (response) {
    case "going":
      return "You're in";
    case "maybe":
      return "Maybe";
    case "cant":
      return "Can't make it";
  }
}

function subtitle(response: RsvpResponse): string {
  switch (response) {
    case "going":
      return "Claim opens when the host uploads the check.";
    case "maybe":
    case "cant":
      return "You can change this anytime.";
  }
}

function detectPlatform(): "ios" | "android" | "web" {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
}

type Props = {
  receipt: PublicReceipt;
  response: RsvpResponse;
  busy?: boolean;
  onChangeRsvp: () => void;
  onGoing: () => void;
  onMaybe: () => void;
  onCant: () => void;
};

export function RsvpConfirmation({
  receipt,
  response,
  busy,
  onChangeRsvp,
  onGoing,
  onMaybe,
  onCant,
}: Props) {
  const [mapFailed, setMapFailed] = useState(false);
  const venue = receipt.venue;
  const lat = venue?.lat;
  const lng = venue?.lng;
  const when = formatWhen(receipt.nightAt);
  const place = receipt.restaurant?.trim() || "Your outing";
  const note = hostNoteText(receipt.hostInfo);
  const reach = receipt.hostInfo?.reach ?? null;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const mapUri = useMemo(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return staticMapForClient(lat, lng, origin);
  }, [lat, lng, origin]);

  const dirUrl = directionsUrl(
    { lat, lng, name: place, googleMapsUri: venue?.googleMapsUri },
    detectPlatform(),
  );
  const reachHref = reach ? hostReachUrl(reach) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[280px] w-full overflow-hidden">
        {mapUri && !mapFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapUri}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setMapFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-ink-soft" aria-hidden />
        )}
        <div className="absolute inset-0 bg-[rgba(42,36,28,0.52)]" />
        <div className="relative px-5 pb-6 pt-12">
          <p className="mb-1.5 text-[15px] font-semibold uppercase tracking-wide text-[rgba(255,252,248,0.9)]">
            {headline(response)}
          </p>
          <h2 className="mb-4 text-[22px] font-bold leading-7 text-[#FFFcf8]">{place}</h2>
          {when ? (
            <div>
              <p className="text-[15px] font-semibold tabular-nums text-[rgba(255,252,248,0.88)]">
                {when.date}
              </p>
              <p className="text-[34px] font-bold tabular-nums tracking-tight text-[#FFFcf8]">
                {when.time}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 py-5">
        <p className="text-[15px] leading-[22px] text-muted-foreground">{subtitle(response)}</p>
        <HostMessage note={note} />
        {dirUrl ? (
          <ContinueButton onClick={() => window.open(dirUrl, "_blank", "noopener,noreferrer")}>
            Get directions
          </ContinueButton>
        ) : null}
        {reachHref ? (
          dirUrl ? (
            <QuietButton onClick={() => window.open(reachHref, "_blank", "noopener,noreferrer")}>
              {`Contact host · ${HOST_REACH_LABEL[reach!.channel]}`}
            </QuietButton>
          ) : (
            <ContinueButton onClick={() => window.open(reachHref, "_blank", "noopener,noreferrer")}>
              {`Contact host · ${HOST_REACH_LABEL[reach!.channel]}`}
            </ContinueButton>
          )
        ) : null}
        <QuietButton disabled={busy} onClick={onChangeRsvp}>
          Change RSVP
        </QuietButton>
        <div className="mt-1 flex flex-col gap-1">
          <QuietButton disabled={busy} onClick={onGoing}>
            {response === "going" ? "Still going" : "Going"}
          </QuietButton>
          <QuietButton disabled={busy} onClick={onMaybe}>
            {response === "maybe" ? "Still maybe" : "Maybe"}
          </QuietButton>
          <QuietButton disabled={busy} onClick={onCant}>
            {response === "cant" ? "Still can't" : "Can't"}
          </QuietButton>
        </div>
      </div>
    </div>
  );
}
