"use client";

import { PhoneShell } from "@/components/phone-shell";
import { SettleView } from "@/components/settle-view";
import { useReceipt } from "@/hooks/use-receipt";

export function SettlePage({ receiptId }: { receiptId: string }) {
  const { receipt, error, refresh } = useReceipt(receiptId);

  if (error && !receipt) {
    return (
      <PhoneShell meta="Missing">
        <p className="px-5 py-10 text-[14px] text-muted-foreground">That tab is not here anymore.</p>
      </PhoneShell>
    );
  }

  if (!receipt) {
    return (
      <PhoneShell meta="Totals">
        <p className="px-5 py-16 text-center text-[14px] text-muted-foreground">Adding it up…</p>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell meta="Settle">
      <SettleView receipt={receipt} onChange={refresh} />
    </PhoneShell>
  );
}
