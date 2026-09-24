"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, ChevronLeft } from "lucide-react";
import { ClaimerAvatar } from "@/components/claimer-avatar";
import { QuietButton } from "@/components/interview-chrome";
import { PayMethodIcon } from "@/components/pay-method-icon";
import { hostPayments } from "@/lib/host-pay";
import { centsToLabel } from "@/lib/money";
import { openHostPayWeb, PAY_METHOD_META, payMethodIsOpenable } from "@/lib/pay";
import { api, getGuest, getHostToken } from "@/lib/session";
import { computeTotals } from "@/lib/totals";
import type { HostPayment, PublicReceipt } from "@/lib/types";

function hostDisplayName(receipt: PublicReceipt, isHost: boolean): string {
  if (isHost) {
    const me = getGuest(receipt.id);
    if (me?.name.trim()) return me.name.trim();
  }
  return "the host";
}

export function SettleView({
  receipt,
  onChange,
}: {
  receipt: PublicReceipt;
  onChange?: () => Promise<unknown> | unknown;
}) {
  const router = useRouter();
  const totals = useMemo(() => computeTotals(receipt), [receipt]);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [payHint, setPayHint] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isHost = Boolean(getHostToken(receipt.id));
  const guest = getGuest(receipt.id);
  const payments = hostPayments(receipt.hostInfo);
  const leftover = totals.unclaimedItemCents > 0 && receipt.status !== "finalized";
  const closed = receipt.status === "finalized";
  const hostName = hostDisplayName(receipt, isHost);
  const restaurant = receipt.restaurant || "the check";

  const mine = guest
    ? totals.people.find((p) => p.personName === guest.name)
    : undefined;

  async function reopen() {
    const token = getHostToken(receipt.id);
    setBusy(true);
    try {
      await api(`/api/receipts/${receipt.id}/reopen`, {
        method: "POST",
        hostToken: token,
      });
      await onChange?.();
      router.replace(`/r/${receipt.id}`);
    } catch {
      setMessage("Only the host can reopen claiming.");
    } finally {
      setBusy(false);
    }
  }

  async function payWith(payment: HostPayment, amountCents: number) {
    if (!payMethodIsOpenable(payment.method)) return;
    setPaying(payment.method);
    setPayHint(null);
    try {
      const result = await openHostPayWeb({
        method: payment.method,
        handle: payment.handle,
        amountCents,
        note: `${guest?.name ?? "Guest"} · ${restaurant}`,
      });
      if (result === "copied") {
        setPayHint(
          `Copied ${PAY_METHOD_META[payment.method].label} details — paste in the app.`,
        );
      }
    } finally {
      setPaying(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="-ml-2 flex h-11 items-center">
        <Link
          href={`/r/${receipt.id}`}
          aria-label="Back to the claim board"
          className="pressable flex size-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-6" />
        </Link>
      </div>
      <p className="text-[13px] font-medium text-ink-soft">
        {receipt.restaurant || "The check"}
      </p>
      <h1 className="text-[1.65rem] font-semibold tracking-tight">Who owes what</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        Drinks plus a share of tax and tip. Tapping a payment method opens the host&apos;s app when
        possible — nothing is charged from Split the Wine.
      </p>
      {message ? <p className="mt-3 text-[14px] text-destructive">{message}</p> : null}

      {leftover ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          {centsToLabel(totals.unclaimedItemCents)} still unclaimed. The host can close claiming
          to take leftovers.
        </p>
      ) : null}

      <div className="mt-5 space-y-1 border-y border-border py-3 text-[14px]">
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Banknote className="size-3.5" strokeWidth={2} aria-hidden />
          The tab
        </p>
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

      {mine && mine.totalCents > 0 ? (
        <div className="mt-5 rounded-[14px] border border-border bg-[#FBFAF8] p-3.5">
          <p className="text-[13px] font-semibold text-ink-soft">You owe</p>
          <p className="mt-0.5 text-[1.75rem] font-bold tabular-nums">
            {centsToLabel(mine.totalCents)}
          </p>
          {payments.length > 0 ? (
            <>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                You can pay your share of {centsToLabel(mine.totalCents)} to the host
                {hostName !== "the host" ? `, ${hostName},` : ""} via the following payment
                method{payments.length === 1 ? "" : "s"}:
              </p>
              <ul className="mt-3 space-y-2">
                {payments.map((payment) => {
                  const openable = payMethodIsOpenable(payment.method);
                  const meta = PAY_METHOD_META[payment.method];
                  const row = (
                    <>
                      <PayMethodIcon method={payment.method} size={48} />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-[15px] font-semibold">{meta.label}</span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">
                          {payment.handle}
                        </span>
                      </span>
                    </>
                  );
                  if (openable) {
                    return (
                      <li key={payment.method}>
                        <button
                          type="button"
                          disabled={paying === payment.method}
                          onClick={() => void payWith(payment, mine.totalCents)}
                          className="pressable flex w-full items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-left disabled:opacity-60"
                        >
                          {row}
                          <span className="text-[12px] font-semibold text-primary">
                            {paying === payment.method ? "Opening…" : "Pay"}
                          </span>
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={payment.method}
                      className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5"
                    >
                      {row}
                    </li>
                  );
                })}
              </ul>
              {payHint ? (
                <p className="mt-2 text-[12px] text-muted-foreground">{payHint}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">
              The host hasn&apos;t added a payment method yet.
            </p>
          )}
        </div>
      ) : null}

      <p className="mt-6 mb-3 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Banknote className="size-3.5" strokeWidth={2} aria-hidden />
        Everyone&apos;s share
      </p>
      <ul className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        {totals.people.length === 0 ? (
          <li className="py-8 text-center text-[14px] text-muted-foreground">
            Nobody has claimed yet.
          </li>
        ) : (
          totals.people.map((person) => {
            const amount = centsToLabel(person.totalCents);
            const isYou = guest?.name === person.personName;
            return (
              <li key={`${person.personName}\0${person.personContact ?? ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ClaimerAvatar name={person.personName} size={32} />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {person.personName}
                        {isYou ? " (you)" : ""}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {person.personContact || "no contact"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[1.35rem] font-semibold tabular-nums">{amount}</p>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
                  {person.lines.map((line) => (
                    <li key={line.itemId}>
                      {line.units}× {line.itemName} · {centsToLabel(line.cents)}
                    </li>
                  ))}
                  <li>Share of tax & tip · {centsToLabel(person.feeCents)}</li>
                </ul>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-4 space-y-1">
        <Link
          href={`/r/${receipt.id}`}
          className="pressable inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium"
        >
          Back to the claim board
        </Link>
        {isHost && closed ? (
          <QuietButton disabled={busy} onClick={() => void reopen()}>
            Reopen claiming
          </QuietButton>
        ) : null}
      </div>
    </div>
  );
}
