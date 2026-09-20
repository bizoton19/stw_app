"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { QuietButton } from "@/components/interview-chrome";
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
    <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <p className="text-[13px] font-medium text-ink-soft">
        {receipt.restaurant || "The check"}
      </p>
      <h1 className="text-[1.65rem] font-semibold tracking-tight">Who owes what</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        Drinks plus a share of tax and tip. These messages are requests — nothing is auto-sent.
      </p>

      {leftover ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          {centsToLabel(totals.unclaimedItemCents)} still unclaimed. The host can close claiming
          to take leftovers.
        </p>
      ) : null}

      <div className="mt-5 space-y-1 border-y border-border py-3 text-[14px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Items</span>
          <span className="tabular-nums">{centsToLabel(totals.itemSubtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fees</span>
          <span className="tabular-nums">{centsToLabel(totals.feeTotalCents)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Grand</span>
          <span className="tabular-nums">{centsToLabel(totals.grandTotalCents)}</span>
        </div>
      </div>

      <ul className="mt-4 min-h-0 flex-1 space-y-6 overflow-y-auto">
        {totals.people.length === 0 ? (
          <li className="py-8 text-center text-[14px] text-muted-foreground">
            Nobody has claimed yet.
          </li>
        ) : (
          totals.people.map((person) => {
            const amount = centsToLabel(person.totalCents);
            const text = messageFor(person.personName, amount, handle, method);
            const sms = `sms:?&body=${encodeURIComponent(text)}`;
            const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
            return (
              <li key={person.personName}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-medium">{person.personName}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {person.personContact || "no contact"}
                    </p>
                  </div>
                  <p className="text-[1.35rem] font-semibold tabular-nums">{amount}</p>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
                  {person.lines.map((line) => (
                    <li key={line.itemName}>
                      {line.units}× {line.itemName} · {centsToLabel(line.cents)}
                    </li>
                  ))}
                  <li>Share of tax & tip · {centsToLabel(person.feeCents)}</li>
                </ul>
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{text}</p>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <a
                    href={sms}
                    className="pressable inline-flex h-10 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground"
                  >
                    Texts
                  </a>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="pressable inline-flex h-10 items-center justify-center rounded-full text-[13px] font-medium"
                  >
                    WhatsApp
                  </a>
                  <QuietButton
                    className="h-10 text-[13px]"
                    onClick={async () => {
                      await navigator.clipboard.writeText(text);
                      setCopied(person.personName);
                    }}
                  >
                    {copied === person.personName ? "Copied" : "Copy"}
                  </QuietButton>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <Link
        href={`/r/${receipt.id}`}
        className="pressable mt-4 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium"
      >
        Back to the claim board
      </Link>
    </div>
  );
}
