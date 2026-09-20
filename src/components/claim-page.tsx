"use client";

import { useEffect, useState } from "react";
import { ClaimBoard } from "@/components/claim-board";
import { JoinGuest } from "@/components/join-guest";
import { PhoneShell } from "@/components/phone-shell";
import { useReceipt } from "@/hooks/use-receipt";
import { ensureDemoHost, getGuest, getHostToken, type GuestIdentity } from "@/lib/session";

export function ClaimPage({
  receiptId,
  hostQuery,
}: {
  receiptId: string;
  hostQuery: boolean;
}) {
  const { receipt, error, live, refresh } = useReceipt(receiptId);
  const [guest, setGuest] = useState<GuestIdentity | null>(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    ensureDemoHost(hostQuery);
    setGuest(getGuest(receiptId));
    setIsHost(Boolean(getHostToken(receiptId)) || hostQuery);
  }, [receiptId, hostQuery]);

  if (error && !receipt) {
    return (
      <PhoneShell eyebrow="Missing check">
        <div className="px-5 py-10 text-center">
          <h1 className="font-heading text-2xl font-semibold">We can't find that tab</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Links live in this server's memory. If the preview restarted, start a
            new receipt or open the sample at /r/demo.
          </p>
        </div>
      </PhoneShell>
    );
  }

  if (!receipt) {
    return (
      <PhoneShell eyebrow="Loading">
        <div className="px-5 py-16 text-center text-sm text-muted-foreground">
          Pouring the check…
        </div>
      </PhoneShell>
    );
  }

  if (!guest && !isHost) {
    return (
      <PhoneShell eyebrow={live === "live" ? "Live" : "Reconnecting"}>
        <JoinGuest
          receiptId={receipt.id}
          restaurant={receipt.restaurant}
          onJoined={setGuest}
        />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell
      eyebrow={
        live === "live" ? "Live remaining" : live === "offline" ? "Offline" : "Reconnecting"
      }
    >
      <ClaimBoard receipt={receipt} isHost={isHost} onChange={refresh} />
    </PhoneShell>
  );
}
