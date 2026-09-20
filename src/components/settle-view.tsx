"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { centsToLabel } from "@/lib/money";
import { computeTotals } from "@/lib/totals";
import type { PayMethod, PublicReceipt } from "@/lib/types";

const METHOD_LABEL: Record<PayMethod, string> = {
  venmo: "Venmo",
  zelle: "Zelle",
  cashapp: "Cash App",
  other: "their preferred app",
};

function messageFor(
  name: string,
  amount: string,
  handle: string,
  method: PayMethod,
) {
  return `Hey ${name}, your share is ${amount}. Send it to ${handle} via ${METHOD_LABEL[method]}.`;
}

export function SettleView({ receipt }: { receipt: PublicReceipt }) {
  const totals = useMemo(() => computeTotals(receipt), [receipt]);
  const [copied, setCopied] = useState<string | null>(null);
  const handle = receipt.hostInfo?.handle ?? "the host";
  const method = receipt.hostInfo?.method ?? "other";
  const leftover = totals.unclaimedItemCents > 0 && receipt.status !== "finalized";

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-ink">
        {receipt.restaurant || "The check"}
      </p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Who owes what
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each person pays their drinks plus their share of tax and tip. These
        messages are requests — nothing is auto-sent.
      </p>

      {leftover ? (
        <p className="mt-4 rounded-2xl bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
          {centsToLabel(totals.unclaimedItemCents)} still unclaimed. The host
          can close claiming to take leftovers.
        </p>
      ) : null}

      <div className="mt-4 rounded-2xl bg-ice px-4 py-3 text-sm ring-1 ring-sky-ink/15">
        <div className="flex justify-between">
          <span>Items</span>
          <span className="tabular-nums">{centsToLabel(totals.itemSubtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Fees</span>
          <span className="tabular-nums">{centsToLabel(totals.feeTotalCents)}</span>
        </div>
        <div className="mt-1 flex justify-between font-semibold">
          <span>Grand</span>
          <span className="tabular-nums">{centsToLabel(totals.grandTotalCents)}</span>
        </div>
      </div>

      <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
        {totals.people.length === 0 ? (
          <li className="rounded-2xl bg-card px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border">
            Nobody has claimed yet.
          </li>
        ) : (
          totals.people.map((person) => {
            const amount = centsToLabel(person.totalCents);
            const text = messageFor(person.personName, amount, handle, method);
            const sms = `sms:?&body=${encodeURIComponent(text)}`;
            const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
            return (
              <li key={person.personName} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{person.personName}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.personContact || "no contact"}
                    </p>
                  </div>
                  <p className="font-heading text-xl font-semibold tabular-nums">
                    {amount}
                  </p>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {person.lines.map((line) => (
                    <li key={line.itemName}>
                      {line.units}× {line.itemName} · {centsToLabel(line.cents)}
                    </li>
                  ))}
                  <li>
                    Share of tax & tip · {centsToLabel(person.feeCents)}
                  </li>
                </ul>
                <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed">
                  {text}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button className="h-10 rounded-full" render={<a href={sms} />}>
                    Texts
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-full"
                    render={<a href={wa} target="_blank" rel="noreferrer" />}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full"
                    onClick={async () => {
                      await navigator.clipboard.writeText(text);
                      setCopied(person.personName);
                    }}
                  >
                    {copied === person.personName ? "Copied" : "Copy"}
                  </Button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <Button
        variant="outline"
        className="mt-4 h-12 w-full rounded-full"
        render={<Link href={`/r/${receipt.id}`} />}
      >
        Back to the claim board
      </Button>
    </div>
  );
}
