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
    const identity = getGuest(receiptId);
    const host = Boolean(getHostToken(receiptId)) || hostQuery;
    queueMicrotask(() => {
      setGuest(identity);
      setIsHost(host);
    });
  }, [receiptId, hostQuery]);

  const meta =
    live === "live" ? "Live" : live === "offline" ? "Offline" : "Reconnecting";

  if (error && !receipt) {
    return (
      <PhoneShell meta="Missing">
        <div className="px-5 py-10">
          <h1 className="text-2xl font-semibold tracking-tight">That tab is gone</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Links live in this server&apos;s memory. Start a new receipt or open /r/demo.
          </p>
        </div>
      </PhoneShell>
    );
  }

  if (!receipt) {
    return (
      <PhoneShell meta="Loading">
        <div className="px-5 py-16 text-center text-[14px] text-muted-foreground">
          Opening the check…
        </div>
      </PhoneShell>
    );
  }

  if (!guest && !isHost) {
    return (
      <PhoneShell meta={meta}>
        <JoinGuest
          receiptId={receipt.id}
          restaurant={receipt.restaurant}
          onJoined={setGuest}
        />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell meta={meta}>
      <ClaimBoard receipt={receipt} isHost={isHost} onChange={refresh} />
    </PhoneShell>
  );
}
